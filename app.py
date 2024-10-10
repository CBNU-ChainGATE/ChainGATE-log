from flask import Flask, request, render_template
from flask_socketio import SocketIO
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import threading
from config import ALLOWED_HOSTS, ALLOWED_EXTENSIONS  # ALLOWED_HOSTS와 ALLOWED_EXTENSIONS를 config에서 가져옵니다.

app = Flask(__name__)
socketio = SocketIO(app)
LOG_DIR = "logs"  # 로그 파일이 저장될 디렉토리
LOG_FILES = ["caserver.log", "node1.log", "node2.log", "node3.log", "node4.log"]  # 로그 파일 목록

def initialize_logs():
    """로그 파일 초기화 함수"""
    for log_file in LOG_FILES:
        log_file_path = os.path.join(LOG_DIR, log_file)
        # 로그 파일을 비움 (처음 서버가 시작할 때만)
        with open(log_file_path, 'w') as f:
            f.write("")  # 빈 문자열로 덮어쓰기

def allowed_file(filename):
    """파일의 확장자가 허용된 목록에 있는지 확인하는 함수"""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


@app.route('/upload', methods=['POST'])
def upload_file():
    """로그 내용을 수신하여 해당 로그 파일에 추가하는 엔드포인트"""
    if request.remote_addr not in ALLOWED_HOSTS:
        return "Forbidden: Host not allowed", 403

    # JSON 데이터에서 로그와 파일 이름 추출
    data = request.get_json()
    if data is None or 'log' not in data or 'file_name' not in data:
        return "Invalid JSON data", 400

    log_entry = data['log']
    file_name = data['file_name']

    # 로그 파일 경로 생성
    log_file_path = os.path.join(LOG_DIR, file_name)

    # 로그 내용을 파일에 추가
    with open(log_file_path, 'a') as log_file:
        log_file.write(log_entry + '\n')  # 로그 내용을 추가

    return "Log received", 200


class LogFileHandler(FileSystemEventHandler):
    """로그 파일 변경 감지를 위한 이벤트 핸들러"""
    def on_modified(self, event):
        if event.src_path in [os.path.join(LOG_DIR, log) for log in LOG_FILES]:
            with open(event.src_path, 'r') as f:
                content = f.read()
                socketio.emit('log_update', {'filename': os.path.basename(event.src_path), 'content': content})

def monitor_logs():
    """로그 파일 모니터링 함수"""
    observer = Observer()
    event_handler = LogFileHandler()
    for log_file in LOG_FILES:
        observer.schedule(event_handler, path=os.path.join(LOG_DIR, log_file), recursive=False)
    observer.start()
    try:
        while True:
            socketio.sleep(1)  # 비동기적 대기
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

@app.route('/')
def index():
    """기본 페이지 라우트"""
    log_contents = {}
    # 로그 파일이 존재하면 내용을 읽어옴
    for log_file in LOG_FILES:
        log_path = os.path.join(LOG_DIR, log_file)
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                log_contents[log_file] = f.read()
        else:
            log_contents[log_file] = "No content available."  # 로그 파일이 없을 경우

    return render_template('index.html', log_files=log_contents)

if __name__ == "__main__":
    initialize_logs()
    # 별도의 스레드에서 로그 모니터링 시작
    threading.Thread(target=monitor_logs, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000)

