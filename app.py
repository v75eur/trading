from flask import Flask, render_template, jsonify, request
import json, os, time, random, base64, re

app = Flask(__name__)

STATS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'stats.json')
CHAT_FILE = os.path.join(os.path.dirname(__file__), 'data', 'chat.json')
PSEUDOS_FILE = os.path.join(os.path.dirname(__file__), 'data', 'pseudos.json')
SCREENSHOT_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'screenshots')
os.makedirs(SCREENSHOT_FOLDER, exist_ok=True)
os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)

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
        elif hour < 18: fake = random.randint(12, 25)
        elif hour < 22: fake = random.randint(18, 35)
        else: fake = random.randint(4, 10)
        total = min(real_online + fake, 50)
        if online_cache["value"] == 0:
            online_cache["value"] = total
        else:
            if random.random() < 0.5:
                diff = total - online_cache["value"]
                step = 0
                if diff > 0: step = random.choice([0, 1, 1, 2])
                elif diff < 0: step = random.choice([0, -1, -1, -2])
                else: step = random.choice([-1, 0, 1])
                online_cache["value"] += step
                online_cache["value"] = max(2, min(50, online_cache["value"]))
        online_cache["last_update"] = now
    return jsonify({"online": online_cache["value"]})

latest_screenshot = {"filename": "default_chart.png", "timestamp": 0}
@app.route('/api/chart-screenshot')
def chart_screenshot():
    files = sorted([f for f in os.listdir(SCREENSHOT_FOLDER) if f.endswith(('.png','.jpg','.jpeg'))], reverse=True)
    if files:
        latest_screenshot["filename"] = files[0]
        latest_screenshot["timestamp"] = os.path.getmtime(os.path.join(SCREENSHOT_FOLDER, files[0]))
    return jsonify({"image_url": f"/static/screenshots/{latest_screenshot['filename']}", "updated_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(latest_screenshot['timestamp']))})

@app.route('/api/upload-screenshot', methods=['POST'])
def upload_screenshot():
    data = request.get_json()
    img_data = data.get('image', '')
    if img_data and img_data.startswith('data:image'):
        match = re.match(r'data:image/(png|jpeg);base64,(.*)', img_data)
        if match:
            ext = match.group(1)
            b64 = match.group(2)
            filename = f"chart_{int(time.time())}.{ext}"
            with open(os.path.join(SCREENSHOT_FOLDER, filename), 'wb') as f:
                f.write(base64.b64decode(b64))
            files = sorted(os.listdir(SCREENSHOT_FOLDER))
            for old in files[:-6]:
                os.remove(os.path.join(SCREENSHOT_FOLDER, old))
            return jsonify({"status": "ok"})
    return jsonify({"status": "error"}), 400

@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/app')
def index():
    return render_template('index.html')

@app.route('/api/stats')
def api_stats():
    stats = load_stats()
    now = time.time()
    stats['online'] = {k:v for k,v in stats.get('online',{}).items() if now - v < 300}
    save_stats(stats)
    return jsonify({'likes': stats.get('likes',112), 'visitors': stats.get('visitors',0), 'online': len(stats['online'])})

@app.route('/api/visit', methods=['POST'])
def api_visit():
    stats = load_stats()
    ip = request.remote_addr
    now = time.time()
    stats['online'] = {k:v for k,v in stats.get('online',{}).items() if now - v < 300}
    if ip not in stats['online']:
        stats['visitors'] = stats.get('visitors',0) + 1
    stats['online'][ip] = now
    save_stats(stats)
    return jsonify({'status':'ok'})

@app.route('/api/like', methods=['POST'])
def api_like():
    stats = load_stats()
    ip = request.remote_addr
    if ip not in stats.get('liked_ips', []):
        stats['likes'] = stats.get('likes',112) + 1
        stats.setdefault('liked_ips', []).append(ip)
        save_stats(stats)
        return jsonify({'status':'ok', 'likes': stats['likes']})
    return jsonify({'status':'already', 'likes': stats.get('likes',112)})

@app.route('/api/chat', methods=['GET'])
def get_chat():
    return jsonify(load_chat())

@app.route('/api/chat', methods=['POST'])
def post_chat():
    msgs = load_chat()
    data = request.get_json()
    msg = data.get('message','').strip()
    if msg and len(msg) <= 200:
        msgs.append({'message': msg, 'user': data.get('user','Anonyme'), 'time': time.strftime('%H:%M')})
        save_chat(msgs)
    return jsonify({'status':'ok'})

@app.route('/api/pseudo', methods=['POST'])
def set_pseudo():
    data = request.get_json()
    pseudo = data.get('pseudo','').strip()
    ip = request.remote_addr
    if pseudo and len(pseudo) >= 2:
        pseudos = load_pseudos()
        pseudos[ip] = pseudo
        with open(PSEUDOS_FILE, 'w') as f:
            json.dump(pseudos, f)
        return jsonify({'status':'ok'})
    return jsonify({'status':'error'})

@app.route('/api/pseudo', methods=['GET'])
def get_pseudo():
    ip = request.remote_addr
    pseudos = load_pseudos()
    return jsonify({'pseudo': pseudos.get(ip, '')})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
