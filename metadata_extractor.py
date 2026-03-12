"""
Enhanced Metadata Extractor for Production RAG System

Extracts rich metadata from document chunks to enable:
- Query classification and routing
- Metadata-based filtering
- Improved search accuracy
"""

import re
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class MetadataExtractor:
    """
    Extracts rich metadata from document chunks
    """
    
    # Document type patterns - GENERIC + Common Business Categories
    DOC_TYPE_PATTERNS = {
        # Finance/ERP Documents (Common across companies)
        "finance_invoice": [
            r"invoice",
            r"purchase\s+order",
            r"\bpo\b",
            r"vendor\s+invoice",
            r"billing",
            r"payment\s+terms",
            r"accounts\s+payable",
            r"accounts\s+receivable"
        ],
        "finance_report": [
            r"financial\s+report",
            r"balance\s+sheet",
            r"income\s+statement",
            r"cash\s+flow",
            r"profit\s+and\s+loss",
            r"p&l",
            r"general\s+ledger"
        ],
        "hr_benefits": [
            r"employee\s+benefit",
            r"health\s+insurance",
            r"medical\s+plan",
            r"dental\s+plan",
            r"vision\s+plan",
            r"retirement\s+plan",
            r"401k",
            r"pto\s+policy",
            r"vacation\s+policy"
        ],
        # Technical Documents
        "user_guide": [
            r"user\s+guide",
            r"how\s+to",
            r"step\s+by\s+step",
            r"instructions",
            r"tutorial",
            r"manual"
        ],
        "roadmap": [
            r"roadmap",
            r"future\s+plans",
            r"upcoming\s+features",
            r"release\s+schedule",
            r"product\s+strategy"
        ],
        "release_notes": [
            r"release\s+notes",
            r"version\s+\d+\.\d+",
            r"what's\s+new",
            r"changelog",
            r"updates"
        ],
        "technical_spec": [
            r"technical\s+specification",
            r"architecture",
            r"api\s+reference",
            r"data\s+model",
            r"schema",
            r"white\s+paper"
        ],
        "troubleshooting": [
            r"troubleshooting",
            r"error",
            r"problem",
            r"issue",
            r"fix",
            r"solution"
        ],
        "faq": [
            r"frequently\s+asked",
            r"faq",
            r"common\s+questions"
        ],
        "concepts": [
            r"concepts?\s+guide",
            r"overview",
            r"introduction",
            r"fundamentals"
        ]
    }
    
    # Content type patterns
    CONTENT_TYPE_PATTERNS = {
        "procedural": [
            r"step\s+\d+",
            r"first,",
            r"then,",
            r"next,",
            r"finally,",
            r"to\s+\w+,\s+follow"
        ],
        "conceptual": [
            r"overview",
            r"introduction",
            r"concept",
            r"understanding",
            r"what\s+is"
        ],
        "reference": [
            r"table\s+\d+",
            r"figure\s+\d+",
            r"parameter",
            r"field",
            r"property",
            r"attribute"
        ]
    }
    
    # XA Module patterns
    XA_MODULES = {
        "IM": ["inventory management", "inventory", "stock", "warehouse"],
        "PM": ["procurement", "purchasing", "purchase order"],
        "MRP": ["material requirements planning", "mrp", "planning"],
        "AVP": ["advanced planner", "avp", "planning engine"],
        "MFG": ["manufacturing", "production", "work order"],
        "QM": ["quality management", "quality", "inspection"],
        "FM": ["financial", "accounting", "ledger"]
    }
    
    @staticmethod
    def extract_metadata(text: str, source: str, page: int, chunk_index: int) -> Dict:
        """
        Extract rich metadata from a text chunk
        
        Args:
            text: The chunk text
            source: Source filename
            page: Page number
            chunk_index: Chunk index
            
        Returns:
            Dict with enhanced metadata
        """
        text_lower = text.lower()
        source_lower = source.lower()
        
        # Extract doc_type from filename and content
        doc_type = MetadataExtractor._detect_doc_type(source_lower, text_lower)
        
        # Extract content_type
        content_type = MetadataExtractor._detect_content_type(text_lower)
        
        # Extract XA modules mentioned
        modules = MetadataExtractor._extract_modules(text_lower)
        
        # Extract keywords (top 5 important words)
        keywords = MetadataExtractor._extract_keywords(text)
        
        # Detect if it's a roadmap-related chunk
        is_roadmap = MetadataExtractor._is_roadmap_content(text_lower, source_lower)
        
        return {
            "text": text,
            "source": source,
            "page": page,
            "chunk_index": chunk_index,
            
            # Enhanced metadata
            "doc_type": doc_type,
            "content_type": content_type,
            "modules": modules,
            "keywords": keywords,
            "is_roadmap": is_roadmap,
            "char_count": len(text),
            "word_count": len(text.split())
        }
    
    @staticmethod
    def _detect_doc_type(source: str, text: str) -> str:
        """Detect document type from filename and content"""
        # Check filename first
        for doc_type, patterns in MetadataExtractor.DOC_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, source, re.IGNORECASE):
                    return doc_type
        
        # Check content
        for doc_type, patterns in MetadataExtractor.DOC_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return doc_type
        
        return "general"
    
    @staticmethod
    def _detect_content_type(text: str) -> str:
        """Detect content type from text patterns"""
        for content_type, patterns in MetadataExtractor.CONTENT_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return content_type

        return "general"

    @staticmethod
    def _extract_modules(text: str) -> List[str]:
        """Extract XA modules mentioned in text"""
        modules = []
        for module, keywords in MetadataExtractor.XA_MODULES.items():
            for keyword in keywords:
                if keyword in text:
                    if module not in modules:
                        modules.append(module)
                    break
        return modules

    @staticmethod
    def _extract_keywords(text: str) -> List[str]:
        """Extract top keywords from text (simple version)"""
        # Remove common stop words
        stop_words = {
            'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are',
            'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do',
            'does', 'did', 'will', 'would', 'should', 'could', 'may',
            'might', 'can', 'how', 'what', 'where', 'when', 'who', 'why',
            'this', 'that', 'these', 'those', 'and', 'or', 'but', 'if',
            'for', 'to', 'from', 'in', 'of', 'with', 'by'
        }

        # Extract words
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())

        # Filter and count
        word_freq = {}
        for word in words:
            if word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1

        # Get top 5
        top_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:5]
        return [word for word, _ in top_words]

    @staticmethod
    def _is_roadmap_content(text: str, source: str) -> bool:
        """Detect if content is about product roadmap (not process roadmap)"""
        # Strong indicators of product roadmap
        product_roadmap_indicators = [
            r"future\s+release",
            r"upcoming\s+version",
            r"planned\s+feature",
            r"release\s+schedule",
            r"product\s+strategy",
            r"version\s+\d+\.\d+\s+will",
            r"coming\s+soon",
            r"next\s+quarter",
            r"roadmap.*release"
        ]

        # Indicators of process roadmap (should NOT match)
        process_roadmap_indicators = [
            r"information\s+flow",
            r"process\s+flow",
            r"workflow",
            r"step.*step",
            r"how\s+modules\s+interact"
        ]

        # Check for product roadmap indicators
        has_product_indicators = any(
            re.search(pattern, text, re.IGNORECASE)
            for pattern in product_roadmap_indicators
        )

        # Check for process roadmap indicators
        has_process_indicators = any(
            re.search(pattern, text, re.IGNORECASE)
            for pattern in process_roadmap_indicators
        )

        # Only return True if it's clearly a product roadmap, not a process roadmap
        return has_product_indicators and not has_process_indicators

