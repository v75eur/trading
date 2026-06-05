from flask import Flask, render_template, jsonify, request, make_response
import json, os, time, random, base64
from datetime import datetime

app = Flask(__name__)
STATS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'stats.json')
DAILY_FILE = os.path.join(os.path.dirname(__file__), 'data', 'daily.json')
CHAT_FILE = os.path.join(os.path.dirname(__file__), 'data', 'chat.json')
PSEUDOS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'pseudos.json')
VISITORS_LOG = os.path.join(os.path.dirname(__file__), 'data', 'visitors_log.json')
ADMIN_IPS = []
DAILY_LIMIT = 500

# Dossier pour les captures d'écran
SCREENSHOT_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'screenshots')
os.makedirs(SCREENSHOT_FOLDER, exist_ok=True)

os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)

def load_stats():
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    return {'likes': 112, 'real_likes': 0, 'visitors': 0, 'online': {}, 'liked_ips': []}

def save_stats(s):
    with open(STATS_FILE, 'w') as f:
        json.dump(s, f)

def load_visitors_log():
    if os.path.exists(VISITORS_LOG):
        with open(VISITORS_LOG, 'r') as f:
            return json.load(f)
    return []

def save_visitor(ip, action):
    log = load_visitors_log()
    log.append({'ip': ip, 'time': time.strftime('%Y-%m-%d %H:%M:%S'), 'action': action})
    if len(log) > 200:
        log = log[-200:]
    with open(VISITORS_LOG, 'w') as f:
        json.dump(log, f)

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

def save_pseudo(ip, pseudo):
    pseudos = load_pseudos()
    pseudos[ip] = pseudo
    with open(PSEUDOS_FILE, 'w') as f:
        json.dump(pseudos, f)

def check_daily_limit():
    today = time.strftime('%Y-%m-%d')
    data = {'date': today, 'count': 0}
    if os.path.exists(DAILY_FILE):
        with open(DAILY_FILE, 'r') as f:
            data = json.load(f)
    if data.get('date') != today:
        data = {'date': today, 'count': 0}
    if data['count'] >= DAILY_LIMIT:
        return False
    data['count'] += 1
    with open(DAILY_FILE, 'w') as f:
        json.dump(data, f)
    return True

# Cache pour le compteur en ligne
online_cache = {"value": 0, "last_update": 0}

@app.route('/api/online-display')
def online_display():
    global online_cache
    now = time.time()
    
    if now - online_cache["last_update"] > 120:
        stats = load_stats()
        real_online = len([k for k, v in stats.get('online', {}).items() if now - v < 300])
        
        hour = time.localtime().tm_hour
        if hour < 8:
            fake_base = 3
        elif hour < 12:
            fake_base = 6
        elif hour < 18:
            fake_base = 12
        elif hour < 22:
            fake_base = 18
        else:
            fake_base = 7
        
        total = min(real_online + fake_base, 50)
        
        if online_cache["value"] == 0:
            online_cache["value"] = total
        else:
            diff = total - online_cache["value"]
            step = max(-1, min(1, diff))
            online_cache["value"] += step
        
        online_cache["last_update"] = now
    
    return jsonify({"online": online_cache["value"]})

# Route pour l'image du graphique (capture simulée pour l'instant)
# Plus tard : vraie capture du canvas
@app.route('/api/chart-screenshot')
def chart_screenshot():
    # Pour l'instant, retourne une image par défaut
    # La vraie capture sera faite côté client et envoyée via POST
    return jsonify({
        "image_url": "/static/screenshots/default_chart.png",
        "updated_at": time.strftime('%Y-%m-%d %H:%M:%S')
    })

# Route pour recevoir la capture d'écran depuis le client
@app.route('/api/upload-screenshot', methods=['POST'])
def upload_screenshot():
    data = request.get_json()
    image_data = data.get('image', '')
    if image_data and image_data.startswith('data:image'):
        # Extraire le base64
        import re
        match = re.match(r'data:image/(png|jpeg);base64,(.*)', image_data)
        if match:
            ext = match.group(1)
            img_data = match.group(2)
            filename = f"chart_{int(time.time())}.{ext}"
            filepath = os.path.join(SCREENSHOT_FOLDER, filename)
            with open(filepath, 'wb') as f:
                f.write(base64.b64decode(img_data))
            
            # Garder seulement les 10 dernières captures
            files = sorted(os.listdir(SCREENSHOT_FOLDER))
            for old_file in files[:-10]:
                os.remove(os.path.join(SCREENSHOT_FOLDER, old_file))
            
            return jsonify({"status": "ok", "filename": filename})
    return jsonify({"status": "error"}), 400

# ============================================
# PAGE D'ACCUEIL (LANDING)
# ============================================
@app.route('/')
def landing():
    return render_template('landing.html')

# ============================================
# APPLICATION PRINCIPALE (TRADING)
# ============================================
@app.route('/app')
def index():
    if not check_daily_limit():
        return "<h1>⚠️ Limite 500 visiteurs atteinte. Revenez demain.</h1>", 429
    return render_template('index.html')

@app.route('/ping')
def ping():
    return 'pong', 200, {'Content-Type': 'text/plain'}

@app.route('/api/stats')
def api_stats():
    stats = load_stats()
    now = time.time()
    stats['online'] = {k: v for k, v in stats['online'].items() if now - v < 300 and k not in ADMIN_IPS}
    save_stats(stats)
    today = time.strftime('%Y-%m-%d')
    daily_count = 0
    if os.path.exists(DAILY_FILE):
        with open(DAILY_FILE, 'r') as f:
            d = json.load(f)
            if d.get('date') == today:
                daily_count = d.get('count', 0)
    return jsonify({'likes': stats['likes'], 'visitors': stats['visitors'], 'online': len(stats['online']), 'daily_count': daily_count, 'daily_limit': DAILY_LIMIT})

@app.route('/api/visitors-log')
def api_visitors_log():
    log = load_visitors_log()
    return jsonify(log[-50:])

@app.route('/api/visit', methods=['POST'])
def api_visit():
    stats = load_stats()
    visitor_id = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ',' in visitor_id:
        visitor_id = visitor_id.split(',')[0].strip()
    data = request.get_json() or {}
    is_admin = data.get('admin', False)
    if is_admin:
        if visitor_id not in ADMIN_IPS:
            ADMIN_IPS.append(visitor_id)
        return jsonify({'status': 'ok'})
    now = time.time()
    stats['online'] = {k: v for k, v in stats['online'].items() if now - v < 300}
    if visitor_id not in stats['online'] and visitor_id not in ADMIN_IPS:
        stats['visitors'] += 1
        save_visitor(visitor_id, 'visit')
    if visitor_id not in ADMIN_IPS:
        stats['online'][visitor_id] = now
    save_stats(stats)
    return jsonify({'status': 'ok'})

@app.route('/api/like', methods=['POST'])
def api_like():
    stats = load_stats()
    visitor_id = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ',' in visitor_id:
        visitor_id = visitor_id.split(',')[0].strip()
    if visitor_id in ADMIN_IPS:
        return jsonify({'status': 'admin'})
    if visitor_id not in stats.get('liked_ips', []):
        stats['likes'] += 1
        stats['real_likes'] = stats.get('real_likes', 0) + 1
        if 'liked_ips' not in stats:
            stats['liked_ips'] = []
        stats['liked_ips'].append(visitor_id)
        save_stats(stats)
        save_visitor(visitor_id, 'like')
        return jsonify({'status': 'ok', 'likes': stats['likes']})
    return jsonify({'status': 'already_liked', 'likes': stats['likes']})

@app.route('/api/chat', methods=['GET'])
def get_chat():
    return jsonify(load_chat())

@app.route('/api/chat', methods=['POST'])
def post_chat():
    messages = load_chat()
    data = request.get_json()
    msg = data.get('message', '').strip()
    if msg and len(msg) <= 200:
        messages.append({'message': msg, 'user': data.get('user', 'Anonyme'), 'time': time.strftime('%H:%M')})
        save_chat(messages)
    return jsonify({'status': 'ok'})

@app.route('/api/pseudo', methods=['POST'])
def set_pseudo():
    data = request.get_json()
    pseudo = data.get('pseudo', '').strip()
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ',' in ip:
        ip = ip.split(',')[0].strip()
    if pseudo and len(pseudo) >= 2:
        save_pseudo(ip, pseudo)
        return jsonify({'status': 'ok', 'pseudo': pseudo})
    return jsonify({'status': 'error'})

@app.route('/api/pseudo', methods=['GET'])
def get_pseudo():
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    if ',' in ip:
        ip = ip.split(',')[0].strip()
    pseudos = load_pseudos()
    return jsonify({'pseudo': pseudos.get(ip, '')})

if __name__ == '__main__':
    app.run(debug=True)
