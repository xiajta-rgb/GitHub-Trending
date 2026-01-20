from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class RepositoryStatistic(Base):
    __tablename__ = "repository_statistics"
    
    id = Column(Integer, primary_key=True, index=True)
    repository_id = Column(Integer, ForeignKey("repositories.id"))
    year = Column(Integer, nullable=False)
    week = Column(Integer, nullable=False)
    rank = Column(Integer)
    stars = Column(Integer, default=0)
    forks = Column(Integer, default=0)
    issues = Column(Integer, default=0)
    watchers = Column(Integer, default=0)
    activity_score = Column(Integer, default=0)
    popularity_score = Column(Integer, default=0)
    freshness_score = Column(Integer, default=0)
    overall_score = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=datetime.now)
    
    # 关系
    repository = relationship("Repository", back_populates="statistics")
    
    __table_args__ = (
        {'extend_existing': True},
    )
