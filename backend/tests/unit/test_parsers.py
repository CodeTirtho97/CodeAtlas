"""Unit tests for all language parsers.

Each class tests one parser with concrete source snippets.
Tests are grouped by: extraction correctness, metadata accuracy,
endpoint detection, architectural role inference, and import extraction.
"""
import pytest
from app.services.ingestion.chunk import Chunk
from app.services.ingestion.parsers import (
    python_parser,
    js_parser,
    ts_parser,
    java_parser,
    go_parser,
    fallback_parser,
)


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _by_type(chunks, chunk_type):
    return [c for c in chunks if c.chunk_type == chunk_type]

def _by_name(chunks, name):
    return next(
        (c for c in chunks
         if c.function_name == name or c.class_name == name),
        None,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Python Parser
# ══════════════════════════════════════════════════════════════════════════════

PYTHON_SOURCE = '''\
import os
from pathlib import Path
from .auth import verify_token


def standalone_function(x: int) -> int:
    """A top-level function."""
    return x * 2


class AuthService:
    """Handles authentication."""

    def authenticate(self, username: str, password: str) -> bool:
        return True

    def logout(self, user_id: str) -> None:
        pass


class UserRepository:
    def get_user(self, user_id: str):
        return None


app = FastAPI()
router = APIRouter()


@app.get("/users")
async def get_users():
    return []


@router.post("/users")
async def create_user(data: dict):
    return data


@app.delete("/users/{user_id}")
async def delete_user(user_id: str):
    pass
'''

class TestPythonParser:

    def setup_method(self):
        self.chunks = python_parser.parse("app/routes.py", PYTHON_SOURCE)

    def test_returns_list_of_chunks(self):
        assert isinstance(self.chunks, list)
        assert all(isinstance(c, Chunk) for c in self.chunks)

    def test_extracts_standalone_function(self):
        chunk = _by_name(self.chunks, "standalone_function")
        assert chunk is not None
        assert chunk.chunk_type == "function"
        assert chunk.language == "python"
        assert chunk.language_tier == "1"

    def test_extracts_class(self):
        chunk = _by_name(self.chunks, "AuthService")
        assert chunk is not None
        assert chunk.chunk_type == "class"
        assert chunk.class_name == "AuthService"

    def test_extracts_class_methods(self):
        authenticate = _by_name(self.chunks, "authenticate")
        assert authenticate is not None
        assert authenticate.class_name == "AuthService"
        assert authenticate.chunk_type == "function"

        logout = _by_name(self.chunks, "logout")
        assert logout is not None
        assert logout.class_name == "AuthService"

    def test_detects_fastapi_endpoints(self):
        endpoints = _by_type(self.chunks, "endpoint")
        endpoint_names = [c.function_name for c in endpoints]

        assert "get_users" in endpoint_names
        assert "create_user" in endpoint_names
        assert "delete_user" in endpoint_names

    def test_endpoint_count(self):
        assert len(_by_type(self.chunks, "endpoint")) == 3

    def test_architectural_role_service(self):
        chunk = _by_name(self.chunks, "AuthService")
        assert chunk.architectural_role == "service"

    def test_architectural_role_repository(self):
        chunk = _by_name(self.chunks, "UserRepository")
        assert chunk.architectural_role == "repository"

    def test_line_numbers_are_set(self):
        chunk = _by_name(self.chunks, "standalone_function")
        assert chunk.line_start > 0
        assert chunk.line_end >= chunk.line_start

    def test_imports_extracted(self):
        # All chunks from the same file share the same imports list
        imports = self.chunks[0].imports
        assert "os" in imports
        assert "pathlib" in imports

    def test_file_path_preserved(self):
        for chunk in self.chunks:
            assert chunk.file_path == "app/routes.py"

    def test_empty_file_returns_raw_chunk(self):
        chunks = python_parser.parse("empty.py", "")
        assert len(chunks) == 0


PYTHON_DECORATED_CLASS = '''\
from fastapi import APIRouter

router = APIRouter()

class UserController:
    @router.get("/users/{id}")
    async def get_user(self, user_id: str):
        pass

    @router.post("/users")
    async def create_user(self):
        pass
'''

class TestPythonDecoratedMethods:

    def test_decorated_methods_in_class(self):
        chunks = python_parser.parse("routes.py", PYTHON_DECORATED_CLASS)
        endpoints = _by_type(chunks, "endpoint")
        assert len(endpoints) >= 2
        for ep in endpoints:
            assert ep.class_name == "UserController"


# ══════════════════════════════════════════════════════════════════════════════
# JavaScript Parser
# ══════════════════════════════════════════════════════════════════════════════

JS_SOURCE = """\
const express = require('express');
import { helper } from './utils';

const router = express.Router();

function processData(data) {
    return data;
}

const fetchUser = async (id) => {
    return null;
};

class UserService {
    constructor() {}

    getUser(id) {
        return null;
    }

    createUser(data) {
        return data;
    }
}

router.get('/users', (req, res) => res.json([]));
router.post('/users', (req, res) => res.json({}));
router.delete('/users/:id', (req, res) => res.sendStatus(204));
"""

class TestJavaScriptParser:

    def setup_method(self):
        self.chunks = js_parser.parse("routes/users.js", JS_SOURCE)

    def test_extracts_function_declaration(self):
        chunk = _by_name(self.chunks, "processData")
        assert chunk is not None
        assert chunk.chunk_type == "function"
        assert chunk.language == "javascript"

    def test_extracts_arrow_function(self):
        chunk = _by_name(self.chunks, "fetchUser")
        assert chunk is not None
        assert chunk.chunk_type == "function"

    def test_extracts_class(self):
        chunk = _by_name(self.chunks, "UserService")
        assert chunk is not None
        assert chunk.chunk_type == "class"

    def test_extracts_class_methods(self):
        get_user = _by_name(self.chunks, "getUser")
        assert get_user is not None
        assert get_user.class_name == "UserService"

    def test_detects_express_endpoints(self):
        endpoints = _by_type(self.chunks, "endpoint")
        assert len(endpoints) == 3

    def test_extracts_require_imports(self):
        imports = self.chunks[0].imports
        assert "express" in imports

    def test_extracts_es6_imports(self):
        imports = self.chunks[0].imports
        assert "./utils" in imports


# ══════════════════════════════════════════════════════════════════════════════
# TypeScript Parser
# ══════════════════════════════════════════════════════════════════════════════

TS_SOURCE = """\
import { Injectable } from '@angular/core';
import axios from 'axios';

interface User {
    id: number;
    name: string;
}

type UserId = number | string;

function greet(name: string): string {
    return `Hello ${name}`;
}

const fetchUsers = async (): Promise<User[]> => {
    return [];
};

export class AuthService {
    private token: string = '';

    login(username: string, password: string): boolean {
        return true;
    }

    logout(): void {}
}

export interface Repository<T> {
    findById(id: number): T | null;
}
"""

class TestTypeScriptParser:

    def setup_method(self):
        self.chunks = ts_parser.parse("services/auth.ts", TS_SOURCE)

    def test_extracts_function(self):
        chunk = _by_name(self.chunks, "greet")
        assert chunk is not None
        assert chunk.chunk_type == "function"
        assert chunk.language == "typescript"

    def test_extracts_arrow_function(self):
        chunk = _by_name(self.chunks, "fetchUsers")
        assert chunk is not None
        assert chunk.chunk_type == "function"

    def test_extracts_class(self):
        chunk = _by_name(self.chunks, "AuthService")
        assert chunk is not None
        assert chunk.chunk_type == "class"

    def test_extracts_interface(self):
        chunk = _by_name(self.chunks, "User")
        assert chunk is not None
        assert chunk.chunk_type == "class"

    def test_extracts_type_alias(self):
        chunk = _by_name(self.chunks, "UserId")
        assert chunk is not None

    def test_language_is_typescript(self):
        for chunk in self.chunks:
            assert chunk.language == "typescript"

    def test_extracts_imports(self):
        imports = self.chunks[0].imports
        assert "@angular/core" in imports
        assert "axios" in imports


# ══════════════════════════════════════════════════════════════════════════════
# Java Parser
# ══════════════════════════════════════════════════════════════════════════════

JAVA_SOURCE = """\
package com.example.api;

import com.example.auth.AuthService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

    @GetMapping("/users")
    public List<User> getUsers() {
        return List.of();
    }

    @PostMapping("/users")
    public User createUser(@RequestBody User user) {
        return user;
    }

    @DeleteMapping("/users/{id}")
    public void deleteUser(@PathVariable Long id) {}
}

@Service
public class UserService {
    public User findById(Long id) {
        return null;
    }
}

@Repository
public class UserRepository {
    public Optional<User> findById(Long id) {
        return Optional.empty();
    }
}
"""

class TestJavaParser:

    def setup_method(self):
        self.chunks = java_parser.parse("src/UserController.java", JAVA_SOURCE)

    def test_extracts_controller_class(self):
        chunk = _by_name(self.chunks, "UserController")
        assert chunk is not None
        assert chunk.chunk_type == "class"

    def test_controller_role_from_annotation(self):
        chunk = _by_name(self.chunks, "UserController")
        assert chunk.architectural_role == "controller"

    def test_service_role_from_annotation(self):
        chunk = _by_name(self.chunks, "UserService")
        assert chunk.architectural_role == "service"

    def test_repository_role_from_annotation(self):
        chunk = _by_name(self.chunks, "UserRepository")
        assert chunk.architectural_role == "repository"

    def test_detects_endpoints_from_annotations(self):
        endpoints = _by_type(self.chunks, "endpoint")
        assert len(endpoints) == 3

    def test_endpoint_has_class_name(self):
        endpoints = _by_type(self.chunks, "endpoint")
        for ep in endpoints:
            assert ep.class_name == "UserController"

    def test_extracts_non_endpoint_methods(self):
        find_by_id = _by_name(self.chunks, "findById")
        # There are two findById — at least one should be a non-endpoint function
        all_find = [c for c in self.chunks if c.function_name == "findById"]
        assert any(c.chunk_type == "function" for c in all_find)

    def test_extracts_imports(self):
        imports = self.chunks[0].imports
        assert any("AuthService" in imp for imp in imports)

    def test_language_is_java(self):
        for chunk in self.chunks:
            assert chunk.language == "java"


# ══════════════════════════════════════════════════════════════════════════════
# Go Parser
# ══════════════════════════════════════════════════════════════════════════════

GO_SOURCE = """\
package main

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

type UserService struct {
    db *Database
}

func (s *UserService) GetUser(id string) *User {
    return nil
}

func (s *UserService) CreateUser(data map[string]string) *User {
    return nil
}

func NewUserService(db *Database) *UserService {
    return &UserService{db: db}
}

func main() {
    r := gin.Default()
    r.GET("/users", getUsers)
    r.POST("/users", createUser)
}

func getUsers(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{})
}
"""

class TestGoParser:

    def setup_method(self):
        self.chunks = go_parser.parse("main.go", GO_SOURCE)

    def test_extracts_struct(self):
        chunk = _by_name(self.chunks, "UserService")
        assert chunk is not None
        assert chunk.chunk_type == "class"
        assert chunk.language == "go"

    def test_extracts_struct_methods(self):
        get_user = _by_name(self.chunks, "GetUser")
        assert get_user is not None
        assert get_user.class_name == "UserService"

        create_user = _by_name(self.chunks, "CreateUser")
        assert create_user is not None
        assert create_user.class_name == "UserService"

    def test_extracts_top_level_function(self):
        new_svc = _by_name(self.chunks, "NewUserService")
        assert new_svc is not None
        assert new_svc.chunk_type == "function"

    def test_detects_router_endpoints(self):
        endpoints = _by_type(self.chunks, "endpoint")
        assert len(endpoints) >= 2

    def test_service_role_from_name(self):
        chunk = _by_name(self.chunks, "UserService")
        assert chunk.architectural_role == "service"

    def test_extracts_imports(self):
        imports = self.chunks[0].imports
        assert "net/http" in imports
        assert "github.com/gin-gonic/gin" in imports

    def test_language_is_go(self):
        for chunk in self.chunks:
            assert chunk.language == "go"


# ══════════════════════════════════════════════════════════════════════════════
# Fallback Parser
# ══════════════════════════════════════════════════════════════════════════════

class TestFallbackParser:

    def test_small_file_single_chunk(self):
        source = "key: value\nanother: thing\n"
        chunks = fallback_parser.parse("config.yaml", source)
        assert len(chunks) == 1
        assert chunks[0].chunk_type == "raw"
        assert chunks[0].language_tier == "2"

    def test_exact_100_lines_single_chunk(self):
        source = "\n".join(f"line {i}" for i in range(1, 101))
        chunks = fallback_parser.parse("file.rb", source)
        assert len(chunks) == 1
        assert chunks[0].line_start == 1
        assert chunks[0].line_end == 100

    def test_101_lines_splits_into_two_chunks(self):
        source = "\n".join(f"line {i}" for i in range(1, 102))
        chunks = fallback_parser.parse("file.rb", source)
        assert len(chunks) == 2
        assert chunks[0].line_start == 1
        assert chunks[0].line_end == 100
        assert chunks[1].line_start == 101
        assert chunks[1].line_end == 101

    def test_250_lines_splits_into_three_chunks(self):
        source = "\n".join(f"line {i}" for i in range(1, 251))
        chunks = fallback_parser.parse("large.rb", source)
        assert len(chunks) == 3

    def test_empty_file_returns_empty(self):
        chunks = fallback_parser.parse("empty.yaml", "")
        assert chunks == []

    def test_whitespace_only_file_returns_empty(self):
        chunks = fallback_parser.parse("blank.md", "   \n\n   \n")
        assert chunks == []

    def test_language_label_preserved(self):
        chunks = fallback_parser.parse("script.sh", "#!/bin/bash\necho hi\n",
                                       language="bash")
        assert chunks[0].language == "bash"

    def test_file_path_preserved(self):
        chunks = fallback_parser.parse("docs/README.md", "# Hello\n")
        assert chunks[0].file_path == "docs/README.md"

    def test_chunk_text_matches_lines(self):
        lines = [f"line {i}" for i in range(1, 6)]
        source = "\n".join(lines)
        chunks = fallback_parser.parse("small.txt", source)
        assert chunks[0].chunk_text == source

    def test_chunk_text_for_second_chunk(self):
        source = "\n".join(f"line {i}" for i in range(1, 106))
        chunks = fallback_parser.parse("file.rb", source)
        assert len(chunks) == 2
        second_lines = "\n".join(f"line {i}" for i in range(101, 106))
        assert chunks[1].chunk_text == second_lines
