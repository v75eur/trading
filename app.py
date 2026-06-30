from flask import Flask, render_template, jsonify, request
import json, os, time, random, base64, re
import datetime
import pytz
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# ====================================================
# NEON DATABASE - UNIQUEMENT via variable d'environnement
# ====================================================

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL environment variable is not set!")

def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    """Crée la table si elle n'existe pas encore."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS chat (
                        id bigint generated always as identity primary key,
                        pseudo text not null,
                        message text not null,
                        created_at timestamptz not null default now()
                    );
                    CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat (created_at);
                """)
            conn.commit()
            print("✅ Base de données initialisée avec succès")
    except Exception as e:
        print(f"❌ [DB INIT ERROR] {e}")

# Initialiser la base de données au démarrage
init_db()

# ====================================================
# FICHIERS STATIQUES
# ====================================================

STATS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'stats.json')
PSEUDOS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'pseudos.json')
SCREENSHOT_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'screenshots')
os.makedirs(SCREENSHOT_FOLDER, exist_ok=True)
os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)

# ====================================================
# HEURE BÉNIN
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
# BLOQUER VISITEURS 00H-7H40
# ====================================================

@app.before_request
def check_business_hours():
    if request.path in ('/health', '/api/ping'):
        return None
    h, m = heure_minute_benin()
    if (h, m) < (7, 40):
        return render_template('maintenance.html'), 503

# ====================================================
# STATS (JSON)
# ====================================================

def load_stats():
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    return {'likes': 112, 'visitors': 0, 'online': {}, 'liked_ips': []}

def save_stats(s):
    with open(STATS_FILE, 'w') as f:
        json.dump(s, f)

def load_pseudos():
    if os.path.exists(PSEUDOS_FILE):
        with open(PSEUDOS_FILE, 'r') as f:
            return json.load(f)
    return {}

online_cache = {"value": 12, "last_update": 0}

@app.route('/api/online-display')
def online_display():
    global online_cache
    now = time.time()
    if now - online_cache["last_update"] > 35:
        stats = load_stats()
        real_online = len([k for k, v in stats.get('online', {}).items() if now - v < 300])
        h = heure_benin()
        if h < 8: fake = 0
        elif h < 12: fake = random.randint(5, 12)
        elif h < 18: fake = random.randint(8, 18)
        elif h < 24: fake = random.randint(10, 22)
        else: fake = random.randint(4, 10)
        online_cache["value"] = real_online + fake
        online_cache["last_update"] = now
    return jsonify({"online": online_cache["value"]})

@app.route('/api/ping')
def ping():
    return "pong"

@app.route('/api/stats')
def stats():
    stats = load_stats()
    return jsonify({"likes": stats.get('likes', 0), "visitors": stats.get('visitors', 0)})

@app.route('/api/like', methods=['POST'])
def like():
    ip = request.remote_addr
    stats = load_stats()
    liked = stats.get('liked_ips', [])
    if ip in liked:
        return jsonify({"liked": True, "likes": stats.get('likes', 0)})
    liked.append(ip)
    stats['likes'] = stats.get('likes', 0) + 1
    stats['liked_ips'] = liked
    save_stats(stats)
    return jsonify({"liked": True, "likes": stats['likes']})

@app.route('/api/visit', methods=['POST'])
def visit():
    ip = request.remote_addr
    stats = load_stats()
    stats['visitors'] = stats.get('visitors', 0) + 1
    now = time.time()
    if 'online' not in stats: stats['online'] = {}
    stats['online'][ip] = now
    stats['online'] = {k: v for k, v in stats['online'].items() if now - v < 300}
    save_stats(stats)
    return jsonify({"ok": True})

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

# ====================================================
# CHAT — Neon PostgreSQL
# ====================================================

@app.route('/api/chat', methods=['GET'])
def get_chat():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                # Purge automatique des messages > 30 jours
                cur.execute("DELETE FROM chat WHERE created_at < now() - interval '30 days'")
                # Récupère les 30 derniers messages
                cur.execute("""
                    SELECT pseudo, message,
                           to_char(created_at AT TIME ZONE 'Africa/Porto-Novo', 'HH24:MI') AS time
                    FROM chat
                    ORDER BY created_at DESC
                    LIMIT 30
                """)
                rows = cur.fetchall()
            conn.commit()
        # On retourne du plus ancien au plus récent
        messages = list(reversed([dict(r) for r in rows]))
        return jsonify(messages)
    except Exception as e:
        print(f"❌ [get_chat ERROR] {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def post_chat():
    data = request.json
    if not data or 'pseudo' not in data or 'message' not in data:
        return jsonify({"error": "missing fields"}), 400
    pseudo = data['pseudo'][:20]
    message = data['message'][:200]
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO chat (pseudo, message) VALUES (%s, %s)",
                    (pseudo, message)
                )
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"❌ [post_chat ERROR] {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/clear-chat', methods=['POST'])
def clear_chat():
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM chat")
            conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        print(f"❌ [clear_chat ERROR] {e}")
        return jsonify({"error": str(e)}), 500

# ====================================================
# PSEUDO (JSON)
# ====================================================

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

# ====================================================
# ERREUR 404 PERSONNALISÉE
# ====================================================

@app.errorhandler(404)
def page_not_found(e):
    return render_template('maintenance.html'), 404

# ====================================================
# LANCEMENT
# ====================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
