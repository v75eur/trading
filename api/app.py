from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import time
import random
import datetime
import pytz

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
STATS_FILE = os.path.join(DATA_DIR, 'stats.json')
CHAT_FILE = os.path.join(DATA_DIR, 'chat.json')
PSEUDOS_FILE = os.path.join(DATA_DIR, 'pseudos.json')
os.makedirs(DATA_DIR, exist_ok=True)

def heure_benin():
    tz = pytz.timezone('Africa/Porto-Novo')
    return datetime.datetime.now(tz).hour

def load_json(path, default):
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return default

def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f)

online_cache = {"value": 12, "last_update": 0}

@app.route('/health')
def health():
    return "OK", 200

@app.route('/api/ping')
def ping():
    return "pong"

@app.route('/api/online')
def online():
    global online_cache
    now = time.time()
    if now - online_cache["last_update"] > 35:
        stats = load_json(STATS_FILE, {'online': {}})
        real = len([k for k, v in stats.get('online', {}).items() if now - v < 300])
        h = heure_benin()
        if h < 8: fake = 0
        elif h < 12: fake = random.randint(5, 12)
        elif h < 18: fake = random.randint(8, 18)
        else: fake = random.randint(10, 22)
        online_cache["value"] = real + fake
        online_cache["last_update"] = now
    return jsonify({"online": online_cache["value"]})

@app.route('/api/stats')
def stats():
    s = load_json(STATS_FILE, {'likes': 112, 'visitors': 0})
    return jsonify({"likes": s.get('likes', 0), "visitors": s.get('visitors', 0)})

@app.route('/api/like', methods=['POST'])
def like():
    ip = request.remote_addr
    s = load_json(STATS_FILE, {'likes': 112, 'visitors': 0, 'online': {}, 'liked_ips': []})
    if ip in s.get('liked_ips', []):
        return jsonify({"liked": True, "likes": s['likes']})
    s['liked_ips'] = s.get('liked_ips', []) + [ip]
    s['likes'] = s.get('likes', 0) + 1
    save_json(STATS_FILE, s)
    return jsonify({"liked": True, "likes": s['likes']})

@app.route('/api/visit', methods=['POST'])
def visit():
    ip = request.remote_addr
    s = load_json(STATS_FILE, {'likes': 112, 'visitors': 0, 'online': {}, 'liked_ips': []})
    s['visitors'] = s.get('visitors', 0) + 1
    now = time.time()
    s['online'][ip] = now
    s['online'] = {k: v for k, v in s['online'].items() if now - v < 300}
    save_json(STATS_FILE, s)
    return jsonify({"ok": True})

@app.route('/api/chat', methods=['GET'])
def get_chat():
    return jsonify(load_json(CHAT_FILE, []))

@app.route('/api/chat', methods=['POST'])
def post_chat():
    data = request.json
    if not data or 'pseudo' not in data or 'message' not in data:
        return jsonify({"error": "missing fields"}), 400
    msgs = load_json(CHAT_FILE, [])
    msgs.append({'pseudo': data['pseudo'][:20], 'message': data['message'][:200], 'time': time.strftime('%H:%M')})
    if len(msgs) > 30: msgs = msgs[-30:]
    save_json(CHAT_FILE, msgs)
    return jsonify({"success": True})

@app.route('/api/pseudo', methods=['POST'])
def set_pseudo():
    data = request.json
    if not data or 'pseudo' not in data:
        return jsonify({"error": "missing pseudo"}), 400
    p = load_json(PSEUDOS_FILE, {})
    p[request.remote_addr] = data['pseudo'][:20]
    save_json(PSEUDOS_FILE, p)
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
