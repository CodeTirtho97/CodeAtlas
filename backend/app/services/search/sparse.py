"""Sparse vector generation for hybrid BM25-like keyword search.

Uses feature hashing (vocabulary-free) to convert text into a sparse
vector representation suitable for Qdrant's sparse vector index.

Why feature hashing?
  - No vocabulary to build or persist between ingestion and query time
  - Works identically on any text at both index and search time
  - Hash collisions are rare (VOCAB_SIZE=30_000) and acceptable for retrieval
"""
import hashlib
import re
from collections import Counter
from typing import List, Tuple

from qdrant_client.models import SparseVector

# Hash space — larger reduces collisions, smaller reduces memory
VOCAB_SIZE = 30_000

# Tokens shorter than this are treated as stopwords and skipped
MIN_TOKEN_LEN = 2


def to_sparse_vector(text: str) -> SparseVector:
    """Convert raw text to a hash-based sparse TF vector.

    Each unique token is hashed to a bucket index. The value is the
    normalised term frequency (count / total_tokens).

    Returns a SparseVector with no duplicate indices.
    """
    tokens = _tokenize(text)
    if not tokens:
        return SparseVector(indices=[], values=[])

    tf = Counter(tokens)
    total = len(tokens)

    indices: List[int] = []
    values: List[float] = []
    seen: set = set()

    for token, count in tf.items():
        bucket = _hash_token(token)
        if bucket in seen:
            continue  # skip hash collision (rare, acceptable)
        seen.add(bucket)
        indices.append(bucket)
        values.append(count / total)  # normalised TF

    return SparseVector(indices=indices, values=values)


def _tokenize(text: str) -> List[str]:
    """Lower-case word tokenizer that strips punctuation."""
    tokens = re.findall(r'\b[a-zA-Z_]\w*\b', text)
    return [t.lower() for t in tokens if len(t) >= MIN_TOKEN_LEN]


def _hash_token(token: str) -> int:
    return int(hashlib.md5(token.encode()).hexdigest(), 16) % VOCAB_SIZE
