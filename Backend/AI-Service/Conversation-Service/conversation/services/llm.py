"""
Service LLM pour le Conversation-Service.
Répond au chat via OpenAI-compatible API, repli sur regles.py.
"""
from __future__ import annotations
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_config():
    return {
        "api_key": getattr(settings, "LLM_API_KEY", ""),
        "model": getattr(settings, "LLM_MODEL", "gpt-4o-mini"),
        "base_url": getattr(settings, "LLM_BASE_URL", "https://api.openai.com/v1"),
    }


def _appel_llm(messages: list[dict], max_tokens: int = 1500) -> str | None:
    cfg = _get_config()
    if not cfg["api_key"]:
        return None
    try:
        import requests
        res = requests.post(
            f"{cfg['base_url']}/chat/completions",
            headers={"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"},
            json={"model": cfg["model"], "messages": messages, "temperature": 0.3, "max_tokens": max_tokens},
            timeout=30,
        )
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        logger.warning("LLM indisponible : %s — repli sur les règles.", exc)
        return None


PROMPT_SYSTEME = (
    "Tu es un co-fondateur expérimenté qui conseille un entrepreneur de manière bienveillante, "
    "pratique et directe. Tu parles en français. Tu fournis des conseils concrets et actionnables. "
    "Tu connais bien les startups, le financement, le droit des sociétés et le marketing."
)


def repondre_chat_llm(
    question: str,
    projet_data: dict,
    historique: list,
    analyse_data: dict | None = None,
    donnees_marche: dict | None = None,
) -> str | None:
    if donnees_marche is None:
        donnees_marche = {}

    concurrents = donnees_marche.get("concurrents", [])
    tendances = donnees_marche.get("tendances", [])
    concurrence_info = f"{donnees_marche.get('niveau_concurrence', 'inconnu')} ({len(concurrents)} concurrents répertoriés)"
    tendances_str = ", ".join([f"{t.get('titre')} [{t.get('impact')}]" for t in tendances[:3] if isinstance(t, dict)])

    contexte = (
        f"Projet : {projet_data.get('titre', 'N/A')} | Stade : {projet_data.get('stade', 'N/A')} | Secteur : {projet_data.get('secteur', 'N/A')}\n"
        f"Idée : {projet_data.get('idee', '')[:200]}\n"
        f"Objectifs : {projet_data.get('objectifs', '')[:200]}\n"
        f"Public cible : {projet_data.get('public_cible', 'N/A')}\n"
        f"Budget : {projet_data.get('budget_estime', 'N/A')}\n"
        f"Concurrence (ETUDE-SERVICE) : {concurrence_info}\n"
        f"Tendances marché : {tendances_str or 'N/A'}\n"
    )
    if analyse_data:
        contexte += f"Score : {analyse_data.get('score_global')}/100 | Forces : {analyse_data.get('forces', [])[:2]} | Faiblesses : {analyse_data.get('faiblesses', [])[:2]}\n"

    messages = [
        {"role": "system", "content": PROMPT_SYSTEME + "\n\nContexte du projet:\n" + contexte}
    ]
    for msg in historique[-10:]:
        messages.append({"role": "user" if msg["role"] == "utilisateur" else "assistant", "content": msg["contenu"]})
    messages.append({"role": "user", "content": question})

    return _appel_llm(messages, max_tokens=600)
