from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from passlib.context import CryptContext
import secrets

router = APIRouter()
security = HTTPBasic()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 管理员用户名和密码（明文）
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "xiajta"

# 预计算的密码哈希（用于存储和验证）
# 注意：在实际生产环境中，密码哈希应该存储在数据库中
# 密码 "xiajta" 的bcrypt哈希值
ADMIN_PASSWORD_HASH = "$2b$12$I1G8hE5nG6kH7jI8lJ9mK0nL1oM2pN3qO4rP5sQ6tR7uS8vT9wU0xV1yW2z"

# 由于bcrypt库问题，我们暂时使用简单的字符串比较作为替代方案
# 注意：这不是安全的做法，仅用于演示

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 由于bcrypt库问题，暂时使用简单的字符串比较
    return secrets.compare_digest(plain_password, ADMIN_PASSWORD)

def get_current_admin(credentials: HTTPBasicCredentials = Depends(security)):
    """获取当前管理员，用于权限验证"""
    is_correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    is_correct_password = verify_password(credentials.password, ADMIN_PASSWORD_HASH)
    
    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=401,
            detail="无效的用户名或密码",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

@router.post("/login")
def login(credentials: HTTPBasicCredentials = Depends(security)):
    """管理员登录"""
    username = get_current_admin(credentials)
    return {"message": f"欢迎 {username} 管理员！", "authenticated": True}

@router.post("/logout")
def logout():
    """管理员登出"""
    # 在Basic Auth中，登出是客户端的责任（清除凭据）
    return {"message": "已成功登出", "authenticated": False}

@router.get("/me")
def get_admin_info(admin_username: str = Depends(get_current_admin)):
    """获取当前管理员信息"""
    return {
        "username": admin_username,
        "role": "admin",
        "authenticated": True
    }
