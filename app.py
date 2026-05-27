from flask import Flask, render_template, jsonify, request, make_response
import json, os, time

app = Flask(__name__)
STATS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'stats.json')
DAILY_FILE = os.path.join(os.path.dirname(__file__), 'data', 'daily.json')
CHAT_FILE = os.path.join(os.path.dirname(__file__), 'data', 'chat.json')
PSEUDOS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'pseudos.json')
VISITORS_LOG = os.path.join(os.path.dirname(__file__), 'data', 'visitors_log.json')
ADMIN_IPS = []
DAILY_LIMIT = 500

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

@app.route('/')
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
