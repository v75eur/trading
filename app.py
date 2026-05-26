from flask import Flask, render_template, jsonify, request
import json, os, time

app = Flask(__name__)
STATS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'stats.json')
DAILY_FILE = os.path.join(os.path.dirname(__file__), 'data', 'daily.json')
ADMIN_IPS = []
DAILY_LIMIT = 500

os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)

def load_stats():
    if os.path.exists(STATS_FILE):
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    return {'likes': 545, 'real_likes': 0, 'visitors': 0, 'online': {}, 'liked_ips': []}

def save_stats(s):
    with open(STATS_FILE, 'w') as f:
        json.dump(s, f)

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
        return "<h1 style='color:white;text-align:center;margin-top:100px;font-family:Arial;background:#0d1117;height:100vh;'>⚠️ Limite quotidienne de 500 visiteurs atteinte.<br>Revenez demain.</h1>", 429
    return render_template('index.html')

@app.route('/ping')
def ping():
    return 'OK', 200

@app.route('/api/stats')
def api_stats():
    stats = load_stats()
    now = time.time()
    stats['online'] = {k: v for k, v in stats['online'].items() if now - v < 300 and k not in ADMIN_IPS}
    save_stats(stats)
    return jsonify({'likes': stats['likes'], 'visitors': stats['visitors'], 'online': len(stats['online'])})

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
        return jsonify({'status': 'ok', 'likes': stats['likes']})
    return jsonify({'status': 'already_liked', 'likes': stats['likes']})

if __name__ == '__main__':
    app.run(debug=True)
