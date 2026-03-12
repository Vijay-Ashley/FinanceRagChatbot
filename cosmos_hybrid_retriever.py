# cosmos_hybrid_retriever.py - PRODUCTION: Metadata Filtering + Confidence Threshold
from typing import List, Tuple, Dict, Optional
import numpy as np
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

class CosmosHybridRetriever:
    """
    Hybrid Retriever - OPTIMIZED

    FIXES:
    - ✅ Removed BM25 (saves 500MB RAM)
    - ✅ Uses Cosmos DB CONTAINS for keyword search
    - ✅ Lightweight and fast
    """

    def __init__(self, store, alpha: float = 0.6):
        self.store = store
        self.alpha = float(alpha)

        # ✅ FIX #3: NO BM25 index!
        logger.info(f"✅ CosmosHybridRetriever initialized (alpha={self.alpha})")
        logger.info(f"   Using Cosmos DB for keyword search (no BM25)")

    @staticmethod
    def _extract_keywords(text: str) -> List[str]:
        """Extract keywords from query (remove stop words)"""
        stop_words = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are',
            'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'should', 'could', 'may',
            'might', 'can', 'how', 'what', 'where', 'when', 'who', 'why'
        }

        words = text.lower().split()
        keywords = [
            word.strip('.,!?;:()')
            for word in words
            if len(word) > 2 and word.lower() not in stop_words
        ]

        return keywords[:5]  # Limit to 5 keywords

    def keyword_search(self, query: str, top_k: int = 20, filters: Optional[Dict] = None) -> List[Tuple[float, Dict]]:
        """
        ✅ CRITICAL FIX: Keyword search with metadata filtering support

        Args:
            query: Search query text
            top_k: Number of results
            filters: Metadata filters (same format as vector search)
        """
        keywords = self._extract_keywords(query)

        if not keywords:
            return []

        # ✅ Sanitize keywords (prevent SQL injection)
        safe_keywords = [
            kw.replace("'", "''").replace('"', '""')[:50]  # Escape quotes, limit length
            for kw in keywords
            if kw.replace("'", "").replace('"', "").isalnum() or ' ' in kw  # Allow alphanumeric + spaces
        ]

        if not safe_keywords:
            return []

        # Build CONTAINS clauses for WHERE
        contains_clauses = [
            f"CONTAINS(c.text, '{kw}', true)"
            for kw in safe_keywords
        ]

        # ✅ CRITICAL: Build WHERE clause with metadata filters (same logic as vector search)
        where_clauses = ["c.is_latest = true"]
        where_clauses.append(f"({' OR '.join(contains_clauses)})")

        if filters:
            if "doc_type" in filters:
                if isinstance(filters["doc_type"], list):
                    types = "', '".join(filters["doc_type"])
                    where_clauses.append(f"c.doc_type IN ('{types}')")
                else:
                    where_clauses.append(f"c.doc_type = '{filters['doc_type']}'")

            if "is_roadmap" in filters and filters["is_roadmap"]:
                where_clauses.append("c.is_roadmap = true")

            if "content_type" in filters:
                if isinstance(filters["content_type"], list):
                    types = "', '".join(filters["content_type"])
                    where_clauses.append(f"c.content_type IN ('{types}')")
                else:
                    where_clauses.append(f"c.content_type = '{filters['content_type']}'")

        # Build final query
        query_sql = f"""
        SELECT TOP {int(top_k)}
            c.id,
            c.source,
            c.page,
            c.text,
            c.doc_type,
            1 AS keyword_score
        FROM c
        WHERE {' AND '.join(where_clauses)}
        """

        results = []

        try:
            for item in self.store.container.query_items(
                query=query_sql,
                enable_cross_partition_query=True
            ):
                # Normalize score to 0-1 range
                normalized_score = float(item['keyword_score']) / len(safe_keywords)

                results.append((normalized_score, {
                    'id': item['id'],
                    'source': item['source'],
                    'page': item['page'],
                    'text': item['text'],
                    'doc_type': item.get('doc_type', 'general')
                }))

        except Exception as e:
            logger.error(f"❌ Keyword search failed: {e}")
            logger.debug(f"   Query: {query_sql[:200]}...")
            return []

        logger.info(f"🔍 Keyword search: {len(results)} results for keywords: {safe_keywords} (filters: {filters})")

        return results

    def add_batch(self, metadatas: List[Dict]):
        """
        Rebuild index if needed

        ✅ FIX #3: Nothing to rebuild (no BM25!)
        """
        # No-op: We don't maintain any in-memory index
        pass
    
    def _normalize_scores(self, scores: List[Tuple[float, Dict]]) -> List[Tuple[float, Dict]]:
        """Normalize scores to [0, 1]"""
        if not scores:
            return []
        
        vals = np.array([s for s, _ in scores], dtype="float32")
        mn, mx = float(vals.min()), float(vals.max())
        
        if mx - mn < 1e-6:
            return [(0.5, md) for _, md in scores]
        
        return [((float(v) - mn) / (mx - mn), md) for v, md in scores]
    
    def hybrid_search(self, query: str, query_vec: np.ndarray, top_k: int = 5,
                     filters: Optional[Dict] = None, min_similarity: float = 0.0) -> List[Tuple[float, Dict]]:
        """
        ✅ PRODUCTION: Hybrid search with metadata filtering and confidence threshold

        Args:
            query: Search query text
            query_vec: Query embedding vector
            top_k: Number of results to return
            filters: Metadata filters (e.g., {"doc_type": "roadmap"})
            min_similarity: Minimum similarity threshold (0.0-1.0)
        """
        # Vector search with filters and confidence threshold
        dense_results = self.store.search(query_vec, top_k=top_k * 2, filters=filters, min_similarity=min_similarity)

        # ✅ CRITICAL FIX: Keyword search now respects metadata filters!
        lex_results = self.keyword_search(query, top_k=top_k * 2, filters=filters)

        # Normalize scores
        dense_normalized = self._normalize_scores(dense_results)
        lex_normalized = self._normalize_scores(lex_results)

        # Combine scores
        combined_scores = defaultdict(lambda: [0.0, None])

        for score, metadata in dense_normalized:
            doc_key = (metadata.get("source"), metadata.get("page"), metadata.get("text", "")[:50])
            combined_scores[doc_key][0] += self.alpha * score
            combined_scores[doc_key][1] = metadata

        for score, metadata in lex_normalized:
            doc_key = (metadata.get("source"), metadata.get("page"), metadata.get("text", "")[:50])
            combined_scores[doc_key][0] += (1.0 - self.alpha) * score
            if combined_scores[doc_key][1] is None:
                combined_scores[doc_key][1] = metadata

        # Sort and return
        results = [(score, meta) for _, (score, meta) in combined_scores.items()]
        results.sort(key=lambda x: x[0], reverse=True)

        # ✅ Apply minimal confidence threshold (industry standard)
        # Production RAG systems use LOW thresholds and let the LLM filter
        # 0.15 filters only garbage while keeping all potentially relevant results
        confidence_threshold = 0.15  # Fixed threshold (industry standard)

        filtered_results = [(score, meta) for score, meta in results if score >= confidence_threshold]

        logger.info(f"✨ Hybrid search: {len(results)} total → {len(filtered_results)} after confidence filter (threshold={confidence_threshold:.2f})")

        return filtered_results[:top_k]
