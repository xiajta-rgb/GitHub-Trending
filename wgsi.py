# This file contains the WSGI configuration for the GitHub-Trending project
# for PythonAnywhere deployment

import sys
import os
import asyncio
from io import BytesIO
# 提前导入日志模块，避免异常块中导入失败
import logging
import traceback

# ========== 1. Project Configuration ==========
# Define the project root directory
project_home = '/home/trend/GitHub-Trending'  # PythonAnywhere 上的项目根目录

# Add the project directory to the Python path
if project_home not in sys.path:
    sys.path.insert(0, project_home)
    # 记录路径添加日志，方便排查
    logging.info(f"Added project directory to sys.path: {project_home}")
else:
    logging.info(f"Project directory already in sys.path: {project_home}")

# Change to the project directory
try:
    os.chdir(project_home)
    logging.info(f"Successfully changed working directory to: {project_home}")
except OSError as e:
    logging.error(f"Failed to change working directory: {str(e)}")

# 补充：设置Python编码，避免中文乱码
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

# ========== 2. ASGI to WSGI Adapter ==========
# This adapter converts the FastAPI ASGI app to a WSGI-compatible app
def asgi_to_wsgi(asgi_app):
    def wsgi_app(environ, start_response):
        # Build ASGI scope
        scope = {
            "type": "http",
            "method": environ["REQUEST_METHOD"],
            "path": environ["PATH_INFO"],
            "query_string": environ["QUERY_STRING"].encode("utf-8"),
            "headers": [(k.lower().encode("utf-8"), v.encode("utf-8")) 
                        for k, v in environ.items() if k.startswith("HTTP_")],
            "server": (environ["SERVER_NAME"], int(environ["SERVER_PORT"])),
            "client": (environ.get("REMOTE_ADDR", ""), int(environ.get("REMOTE_PORT", 0))),
        }

        # Store response data
        response_status = '500 Internal Server Error'  # 默认500错误，确保不会为None
        response_headers = [('Content-Type', 'text/plain; charset=utf-8')]  # 默认响应头
        response_body = []

        # ASGI send function
        async def send(message):
            nonlocal response_status, response_headers
            if message["type"] == "http.response.start":
                response_status = f"{message['status']} {message.get('reason', '')}"
                response_headers = [
                    (k.decode("utf-8"), v.decode("utf-8")) 
                    for k, v in message["headers"]
                ]
            elif message["type"] == "http.response.body":
                response_body.append(message.get("body", b""))

        # ASGI receive function (handles request body)
        async def receive():
            wsgi_input = environ.get("wsgi.input", BytesIO(b""))
            request_body = wsgi_input.read() if hasattr(wsgi_input, "read") else b""
            return {"type": "http.request", "body": request_body, "more_body": False}

        # Run the ASGI app
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            # 运行ASGI应用，捕获内部异常
            loop.run_until_complete(asgi_app(scope, receive, send))
        except Exception as e:
            # 记录ASGI应用运行异常
            logging.error(f"ASGI app execution failed: {type(e).__name__}: {str(e)}")
            logging.error(traceback.format_exc())
            # 构造错误响应体
            response_body.append(f"ASGI app error: {str(e)}".encode("utf-8"))
        finally:
            # 确保循环无论是否成功都关闭，避免内存泄漏
            loop.close()

        # Return WSGI response
        start_response(response_status, response_headers)
        return [b"".join(response_body)]

    return wsgi_app

# ========== 3. Import and Initialize the App ==========
# Import the FastAPI app from main.py
try:
    # 确保当前目录在 Python 路径中
    if '.' not in sys.path:
        sys.path.insert(0, '.')
    
    # Import FastAPI application
    from main import app as fastapi_asgi_app
    logging.info("Successfully imported FastAPI app from main.py")
    
    # Convert to WSGI-compatible app
    application = asgi_to_wsgi(fastapi_asgi_app)
    logging.info("Successfully converted ASGI app to WSGI-compatible app")
    
except Exception as e:
    # 完善日志记录，捕获更详细的错误堆栈
    logging.error(f"Application initialization failed: {type(e).__name__}: {str(e)}")
    logging.error("="*80)
    logging.error("Full error traceback:")
    logging.error(traceback.format_exc())
    logging.error("="*80)
    # 抛出异常，让PythonAnywhere捕获并显示在错误日志中
    raise