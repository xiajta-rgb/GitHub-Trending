from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False, index=True)
    week = Column(Integer, nullable=False, index=True)
    report_title = Column(String(255), nullable=False)
    week_start = Column(String(10), nullable=False)
    week_end = Column(String(10), nullable=False)
    total_repositories = Column(Integer, nullable=False, default=0)
    generation_date = Column(DateTime, default=datetime.now)
    next_update = Column(String(10))
    
    # 关系
    repositories = relationship("Repository", back_populates="weekly_report")
    
    __table_args__ = (
        {'extend_existing': True},
    )
