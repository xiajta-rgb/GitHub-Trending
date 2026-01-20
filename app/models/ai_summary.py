from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base

class AISummary(Base):
    __tablename__ = "ai_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"), unique=True)
    summary = Column(Text)
    highlights = Column(JSON, default=[])
    tech_summary = Column(String(100))
    use_case = Column(String(100))
    source = Column(String(50))
    
    # 关系
    repository = relationship("Repository", back_populates="ai_summary")
    
    __table_args__ = (
        {'extend_existing': True},
    )
