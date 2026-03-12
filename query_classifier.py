"""
Query Classifier for Production RAG System

Classifies user queries to enable:
- Query routing to appropriate search strategies
- Metadata filtering
- Early detection of unanswerable questions
"""

import re
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class QueryClassifier:
    """
    Classifies user queries into intent categories
    """
    
    # Query intent patterns - GENERIC + Common Business Categories
    INTENT_PATTERNS = {
        # Finance/ERP Queries
        "finance_query": [
            r"invoice",
            r"purchase\s+order",
            r"\bpo\b",
            r"vendor",
            r"payment",
            r"billing",
            r"accounts\s+payable",
            r"accounts\s+receivable",
            r"financial\s+report",
            r"balance\s+sheet"
        ],
        # HR Queries
        "hr_benefits_query": [
            r"benefit",
            r"insurance",
            r"medical\s+plan",
            r"dental",
            r"vision",
            r"401k",
            r"retirement",
            r"pto",
            r"vacation"
        ],
        # Technical Queries
        "product_roadmap": [
            r"roadmap",
            r"future\s+(plan|release|version|feature)",
            r"upcoming\s+(feature|version|release)",
            r"when\s+will.*release",
            r"next\s+version",
            r"product\s+strategy",
            r"release\s+schedule"
        ],
        "how_to": [
            r"how\s+to",
            r"how\s+do\s+i",
            r"how\s+can\s+i",
            r"steps\s+to",
            r"guide\s+to",
            r"tutorial",
            r"instructions"
        ],
        "troubleshooting": [
            r"error",
            r"problem",
            r"issue",
            r"not\s+working",
            r"fix",
            r"solve",
            r"troubleshoot",
            r"why\s+(is|does|doesn't)"
        ],
        "what_is": [
            r"what\s+is",
            r"what\s+are",
            r"define",
            r"explain",
            r"describe",
            r"tell\s+me\s+about"
        ],
        "configuration": [
            r"configure",
            r"setup",
            r"install",
            r"settings",
            r"parameters",
            r"options"
        ],
        "comparison": [
            r"difference\s+between",
            r"compare",
            r"vs",
            r"versus",
            r"better\s+than"
        ]
    }
    
    # Module-specific patterns
    MODULE_PATTERNS = {
        "IM": ["inventory", "stock", "warehouse"],
        "PM": ["procurement", "purchasing", "purchase"],
        "MRP": ["material requirements", "mrp", "planning"],
        "AVP": ["advanced planner", "avp"],
        "MFG": ["manufacturing", "production"],
        "QM": ["quality", "inspection"],
        "FM": ["financial", "accounting"]
    }
    
    @staticmethod
    def classify(query: str) -> Dict:
        """
        Classify a user query
        
        Args:
            query: User question
            
        Returns:
            Dict with:
                - intent: Primary intent (product_roadmap, how_to, etc.)
                - modules: List of XA modules mentioned
                - filters: Suggested metadata filters
                - confidence: Confidence score (0-1)
        """
        query_lower = query.lower()
        
        # Detect intent
        intent = QueryClassifier._detect_intent(query_lower)
        
        # Detect modules
        modules = QueryClassifier._detect_modules(query_lower)
        
        # Generate metadata filters
        filters = QueryClassifier._generate_filters(intent, modules)
        
        # Calculate confidence
        confidence = QueryClassifier._calculate_confidence(query_lower, intent)
        
        return {
            "intent": intent,
            "modules": modules,
            "filters": filters,
            "confidence": confidence,
            "original_query": query
        }
    
    @staticmethod
    def _detect_intent(query: str) -> str:
        """Detect primary query intent"""
        for intent, patterns in QueryClassifier.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query, re.IGNORECASE):
                    return intent
        
        return "general"
    
    @staticmethod
    def _detect_modules(query: str) -> List[str]:
        """Detect XA modules mentioned in query"""
        modules = []
        for module, keywords in QueryClassifier.MODULE_PATTERNS.items():
            for keyword in keywords:
                if keyword in query:
                    if module not in modules:
                        modules.append(module)
                    break
        return modules
    
    @staticmethod
    def _generate_filters(intent: str, modules: List[str]) -> Dict:
        """Generate metadata filters based on intent and modules"""
        filters = {}

        # Intent-based filters - Routes queries to appropriate document types
        if intent == "finance_query":
            # Finance queries should ONLY search finance documents
            filters["doc_type"] = ["finance_invoice", "finance_report"]
        elif intent == "hr_benefits_query":
            # HR queries should ONLY search HR documents
            filters["doc_type"] = "hr_benefits"
        elif intent == "product_roadmap":
            filters["is_roadmap"] = True
            filters["doc_type"] = "roadmap"
        elif intent == "how_to":
            filters["doc_type"] = "user_guide"
            filters["content_type"] = "procedural"
        elif intent == "troubleshooting":
            filters["doc_type"] = ["troubleshooting", "faq"]
        elif intent == "what_is":
            filters["content_type"] = "conceptual"
        elif intent == "configuration":
            filters["content_type"] = ["procedural", "reference"]

        # Module-based filters
        if modules:
            filters["modules"] = modules

        return filters
    
    @staticmethod
    def _calculate_confidence(query: str, intent: str) -> float:
        """Calculate confidence score for classification"""
        # Simple confidence based on query length and clarity
        words = query.split()
        
        if len(words) < 3:
            return 0.5  # Short queries are ambiguous
        
        if intent == "general":
            return 0.6  # No clear intent
        
        return 0.9  # Clear intent detected

