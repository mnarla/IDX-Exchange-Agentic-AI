#!/usr/bin/env python3
"""
IDX Exchange — Week 6: Embeddings & Vector Search
Python Reference Implementation matching the Intern Handbook.
"""

import os
import sys
from typing import Any, Dict, List, Tuple
import numpy as np

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    # Fallback pure-numpy cosine similarity if scikit-learn is not installed
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return np.array([[0.0]])
        return np.dot(a, b.T) / (norm_a * norm_b)


def get_embedding(text: str, model: str = "text-embedding-3-small") -> List[float]:
    """Generates an OpenAI embedding vector for the given text."""
    if OpenAI is None:
        raise ImportError("openai package not installed. Run `pip install openai`.")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("Missing OPENAI_API_KEY environment variable.")
    client = OpenAI(api_key=api_key)
    text = text.replace("\n", " ").strip()[:8000]  # max token safety
    response = client.embeddings.create(model=model, input=text)
    return response.data[0].embedding


def build_listing_embedding(row: Dict[str, Any]) -> List[float]:
    """Build embedding for a listing (combine key fields and remarks)."""
    price_val = row.get("L_SystemPrice", 0)
    formatted_price = f"{price_val:,}" if isinstance(price_val, (int, float)) else str(price_val)
    text = f"""
    {row.get("L_Type_", "Property")} in {row.get("L_City", "California")}, CA.
    {row.get("L_Keyword2", 0)} beds, {row.get("LM_Dec_3", 0)} baths.
    {row.get("LM_Int2_3", 0)} sq ft. Built {row.get("YearBuilt", "Unknown")}.
    Price: ${formatted_price}.
    {row.get("L_Remarks", "")}
    """.strip()
    return get_embedding(text)


def find_similar_listings(
    query: str,
    listing_embeddings: List[Tuple[str, List[float]]],
    top_k: int = 5,
) -> List[str]:
    """Return top_k listing IDs most similar to the query."""
    query_vec = np.array(get_embedding(query)).reshape(1, -1)
    scores = []
    for listing_id, emb in listing_embeddings:
        sim = cosine_similarity(query_vec, np.array(emb).reshape(1, -1))[0][0]
        scores.append((listing_id, float(sim)))
    scores.sort(key=lambda x: x[1], reverse=True)
    return [lid for lid, _ in scores[:top_k]]


if __name__ == "__main__":
    print("IDX Exchange Week 6 Vector Search reference script.")
    print("Default model: text-embedding-3-small")
    if not os.getenv("OPENAI_API_KEY"):
        print("Note: Set OPENAI_API_KEY to run live OpenAI embedding generation.")

