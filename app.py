from flask import Flask, render_template, jsonify, request
import json, os, time, random, base64, re
import datetime
import pytz
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

PSEUDOS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'pseudos.json')
SCREENSHOT_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'screenshots')
os.makedirs(SCREENSHOT_FOLDER, exist_ok=True)
os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)

# ====================================================
# CONNEXION BASE DE DONNEES (Neon Postgres) - persistant
# ====================================================

DATABASE_URL = os.environ.get('DATABASE_URL')

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, sslmode='require')

def init_db():
    """Cree les tables si elles n'existent pas."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chat (
                    id bigint generated always as identity primary key,
                    pseudo text not null,
                    message text not null,
                    created_at timestamptz not null default now()
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS stats (
                    key text primary key,
                    value integer not null default 0
                );
            """)
            cur.execute("""
                INSERT INTO stats (key, value) VALUES ('likes', 112)
                ON CONFLICT (key) DO NOTHING;
            """)
            cur.execute("""
                INSERT INTO stats (key, value) VALUES ('visitors', 0)
                ON CONFLICT (key) DO NOTHING;
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS liked_ips (
                    ip text primary key
                );
            """)
            conn.commit()
    finally:
        conn.close()

try:
    init_db()
except Exception as e:
    print(f"[WARN] init_db failed: {e}")

# ====================================================
# HEURE BENIN
# ====================================================

def heure_minute_benin():
    tz = pytz.timezone('Africa/Porto-Novo')
    now = datetime.datetime.now(tz)
    return now.hour, now.minute

def heure_benin():
    h, _ = heure_minute_benin()
    return h

# ====================================================
# HEALTH CHECK - TOUJOURS 200 pour Render
# ====================================================

@app.route('/health')
def health():
    h, m = heure_minute_benin()
    status = "OK - Ouvert" if (h, m) >= (7, 40) else "PAUSE - Reprise 7H40 Benin"
    return status, 200

# ====================================================
# BLOQUER VISITEURS 00H-7H40 (mais pas le health check / ping)
# ====================================================

@app.before_request
def check_business_hours():
    if request.path in ('/health', '/api/ping'):
        return None
    h, m = heure_minute_benin()
    if (h, m) < (7, 40):
        return render_template('maintenance.html'), 503

# ====================================================
# CHAT - Neon Postgres persistant, rotation 3 jours
# ====================================================

def load_chat():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("DELETE FROM chat WHERE created_at < now() - interval '3 days';")
            cur.execute("""
                SELECT pseudo, message, to_char(created_at AT TIME ZONE 'Africa/Porto-Novo', 'HH24:MI') AS time
                FROM chat ORDER BY created_at ASC;
            """)
            rows = cur.fetchall()
            conn.commit()
            return [dict(r) for r in rows]
    finally:
        conn.close()

def save_chat_message(pseudo, message):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO chat (pseudo, message) VALUES (%s, %s);",
                (pseudo, message)
            )
            conn.commit()
    finally:
        conn.close()

def clear_all_chat():
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM chat;")
            conn.commit()
    finally:
        conn.close()

# ====================================================
# STATS - Neon Postgres persistant
# ====================================================

def get_stat(key):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM stats WHERE key=%s;", (key,))
            row = cur.fetchone()
            return row[0] if row else 0
    finally:
        conn.close()

def increment_stat(key, amount=1):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO stats (key, value) VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = stats.value + %s;
            """, (key, amount, amount))
            conn.commit()
    finally:
        conn.close()

def check_and_add_liked_ip(ip):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT ip FROM liked_ips WHERE ip=%s;", (ip,))
            if cur.fetchone():
                return False
            cur.execute("INSERT INTO liked_ips (ip) VALUES (%s);", (ip,))
            conn.commit()
            return True
    finally:
        conn.close()

# ====================================================
# PSEUDOS (fichier local - pas critique)
# ====================================================

def load_pseudos():
    if os.path.exists(PSEUDOS_FILE):
        with open(PSEUDOS_FILE, 'r') as f:
            return json.load(f)
    return {}

# ====================================================
# ONLINE CACHE
# ====================================================

online_cache = {"value": 12, "last_update": 0}

@app.route('/api/online-display')
def online_display():
    global online_cache
    now = time.time()
    if now - online_cache["last_update"] > 35:
        h = heure_benin()
        if h < 8: fake = 0
        elif h < 12: fake = random.randint(5, 12)
        elif h < 18: fake = random.randint(8, 18)
        elif h < 24: fake = random.randint(10, 22)
        else: fake = random.randint(4, 10)
        online_cache["value"] = fake
        online_cache["last_update"] = now
    return jsonify({"online": online_cache["value"]})

@app.route('/api/ping')
def ping():
    return "pong"

@app.route('/api/stats')
def stats():
    likes = get_stat('likes')
    visitors = get_stat('visitors')
    return jsonify({"likes": likes, "visitors": visitors})

@app.route('/api/like', methods=['POST'])
def like():
    ip = request.remote_addr
    added = check_and_add_liked_ip(ip)
    if added:
        increment_stat('likes')
    likes = get_stat('likes')
    return jsonify({"liked": True, "likes": likes})

@app.route('/api/visit', methods=['POST'])
def visit():
    increment_stat('visitors')
    return jsonify({"ok": True})

# ====================================================
# SCREENSHOT
# ====================================================

@app.route('/api/screenshot', methods=['POST'])
def upload_screenshot():
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"error": "missing image"}), 400
        img_data = data['image']
        if img_data.startswith('data:image/png;base64,'):
            img_data = img_data.replace('data:image/png;base64,', '')
        img_bytes = base64.b64decode(img_data)
        clean = re.sub(r'[^a-zA-Z0-9]', '_', datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S'))
        filename = f"screenshot_{clean}.png"
        filepath = os.path.join(SCREENSHOT_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(img_bytes)
        return jsonify({"success": True, "filename": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Alias pour corriger le 404 de l'ancien JS
@app.route('/api/chart-screenshot', methods=['GET', 'POST'])
def chart_screenshot_alias():
    return jsonify({"success": True, "filename": None})

# ====================================================
# CHAT ROUTES
# ====================================================

@app.route('/api/chat', methods=['GET'])
def get_chat():
    messages = load_chat()
    return jsonify(messages)

@app.route('/api/chat', methods=['POST'])
def post_chat():
    data = request.json
    if not data or 'pseudo' not in data or 'message' not in data:
        return jsonify({"error": "missing fields"}), 400
    pseudo = data['pseudo'][:20]
    message = data['message'][:200]
    save_chat_message(pseudo, message)
    return jsonify({"success": True})

@app.route('/api/pseudo', methods=['POST'])
def set_pseudo():
    data = request.json
    if not data or 'pseudo' not in data:
        return jsonify({"error": "missing pseudo"}), 400
    pseudo = data['pseudo'][:20]
    ip = request.remote_addr
    pseudos = load_pseudos()
    pseudos[ip] = pseudo
    with open(PSEUDOS_FILE, 'w') as f:
        json.dump(pseudos, f)
    return jsonify({"success": True})

@app.route('/api/pseudo', methods=['GET'])
def get_pseudo():
    ip = request.remote_addr
    pseudos = load_pseudos()
    return jsonify({"pseudo": pseudos.get(ip, None)})

@app.route('/api/admin/clear-chat', methods=['POST'])
def clear_chat():
    clear_all_chat()
    return jsonify({"success": True})


# ====================================================
# TYPING INDICATOR
# ====================================================

typing_cache = {}

@app.route('/api/typing', methods=['POST'])
def set_typing():
    data = request.json
    if not data or 'pseudo' not in data:
        return jsonify({"error": "missing pseudo"}), 400
    pseudo = data['pseudo'][:20]
    typing_cache[pseudo] = time.time()
    return jsonify({"success": True})

@app.route('/api/typing', methods=['GET'])
def get_typing():
    now = time.time()
    # Garder seulement les gens qui ont tapé dans les 4 dernières secondes
    active = [p for p, t in typing_cache.items() if now - t < 4]
    return jsonify({"typing": active})

# ====================================================
# FAVICON
# ====================================================

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('favicon.ico') if os.path.exists(
        os.path.join(os.path.dirname(__file__), 'static', 'favicon.ico')
    ) else ('', 204)

# ====================================================
# PAGES
# ====================================================

@app.route('/app')
def app_page():
    return render_template('index.html')

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/formation')
def formation():
    return render_template('formation.html')

@app.route('/formation2')
def formation2():
    return render_template('formation2.html')

@app.route('/formation3')
def formation3():
    return render_template('formation3.html')

@app.route('/formation4')
def formation4():
    return render_template('formation4.html')

@app.route('/coming-soon')
def coming_soon():
    return render_template('coming-soon.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
