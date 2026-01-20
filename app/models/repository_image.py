from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class RepositoryImage(Base):
    __tablename__ = "repository_images"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    filename = Column(String(255), nullable=False)
    filepath = Column(String(255), nullable=False)
    size = Column(Integer)
    content_type = Column(String(50))
    downloaded_at = Column(DateTime, default=datetime.now)
    original_url = Column(String(255))
    absolute_url = Column(String(255))
    is_representative = Column(Integer, default=0)
    
    # 关系
    repository = relationship("Repository", back_populates="images")
    
    __table_args__ = (
        {'extend_existing': True},
    )
