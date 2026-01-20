from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Repository(Base):
    __tablename__ = "repositories"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    owner = Column(String(100), nullable=False)
    avatar_url = Column(String(255))
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    issues = Column(Integer, default=0)
    watchers = Column(Integer, default=0)
    description = Column(Text)
    homepage = Column(String(255))
    clone_url = Column(String(255))
    ssh_url = Column(String(255))
    html_url = Column(String(255))
    language = Column(String(50))
    primary_language = Column(String(50))
    languages = Column(JSON)
    tech_stack = Column(JSON, default=[])
    topics = Column(JSON, default=[])
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    pushed_at = Column(DateTime)
    
    # 排名相关
    weekly_report_id = Column(Integer, ForeignKey("weekly_reports.id"))
    rank = Column(Integer)
    activity_score = Column(Integer, default=0)
    popularity_score = Column(Integer, default=0)
    freshness_score = Column(Integer, default=0)
    overall_score = Column(Integer, default=0)
    
    # 趋势相关
    trend_status = Column(String(20))
    star_change = Column(Integer, default=0)
    rank_change = Column(Integer, default=0)
    is_new = Column(Integer, default=0)
    last_week_rank = Column(Integer)
    last_week_stars = Column(Integer)
    
    # 关系
    weekly_report = relationship("WeeklyReport", back_populates="repositories")
    ai_summary = relationship("AISummary", back_populates="repository", uselist=False)
    images = relationship("RepositoryImage", back_populates="repository")
    statistics = relationship("RepositoryStatistic", back_populates="repository")
    
    __table_args__ = (
        {'extend_existing': True},
    )
