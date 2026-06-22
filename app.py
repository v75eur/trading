from flask import Flask, render_template, jsonify, request
import json, os, time, random, base64, re
import datetime
import sys

app = Flask(__name__)

STATS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'stats.json')
CHAT_FILE = os.path.join(os.path.dirname(__file__), 'data', 'chat.json')
PSEUDOS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'pseudos.json')
SCREENSHOT_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'screenshots')
os.makedirs(SCREENSHOT_FOLDER, exist_ok=True)
os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)

# ====================================================
# PLAGE HORAIRE : ACTIF DE 00h A 20h, MAINTENANCE DE 20h A 00h
# ====================================================

@app.before_request
def check_business_hours():
    """Bloque les requêtes entre 20h et 00h."""
    now = datetime.datetime.now()
    if now.hour >= 20:  # De 20h à 23h59
        return render_template('maintenance.html'), 503

@app.route('/_restart')
def restart_service():
    """Redémarre l'application à minuit."""
    now = datetime.datetime.now()
    if now.hour == 0 and now.minute < 5:
        os.execv(sys.executable, ['python'] + sys.argv)
    return "Restarting...", 200

# ====================================================
# FIN DE LA MODIFICATION
# ====================================================

def load_stats():
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    return {'likes': 112, 'visitors': 0, 'online': {}, 'liked_ips': []}
def save_stats(s):
    with open(STATS_FILE, 'w') as f:
        json.dump(s, f)

def load_chat():
    if os.path.exists(CHAT_FILE):
        with open(CHAT_FILE, 'r') as f:
            return json.load(f)
    return []
def save_chat(messages):
    if len(messages) > 30:
        messages = messages[-30:]
    with open(CHAT_FILE, 'w') as f:
        json.dump(messages, f)

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
        hour = time.localtime().tm_hour
        if hour < 8: fake = random.randint(2, 6)
        elif hour < 12: fake = random.randint(5, 12)
        elif hour < 18: fake = random.randint(8, 18)
        elif hour < 22: fake = random.randint(10, 22)
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
    # Nettoyer les vieux
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
        # Nettoyer le nom pour éviter les injections
        clean = re.sub(r'[^a-zA-Z0-9]', '_', datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S'))
        filename = f"screenshot_{clean}.png"
        filepath = os.path.join(SCREENSHOT_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(img_bytes)
        return jsonify({"success": True, "filename": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    messages = load_chat()
    messages.append({
        'pseudo': pseudo,
        'message': message,
        'time': time.strftime('%H:%M')
    })
    save_chat(messages)
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
    save_chat([])
    return jsonify({"success": True})

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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
