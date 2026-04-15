from fastapi import APIRouter

from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.articles import router as articles_router
from app.api.routes.ai_explanations import router as ai_explanations_router
from app.api.routes.billing import router as billing_router
from app.api.routes.health import router as health_router
from app.api.routes.reader_data import router as reader_data_router
from app.api.routes.vocab import router as vocab_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(billing_router)
api_router.include_router(articles_router)
api_router.include_router(vocab_router)
api_router.include_router(reader_data_router)
api_router.include_router(ai_explanations_router)
api_router.include_router(analytics_router)
