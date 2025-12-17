# 🎓 Project Presentation Script – *ENTITY*

**AI-Driven Document Automation Platform**

---

## 👤 Student 1: **22A91A61F9**

### *(Introduction, Problem, Objectives & Scope)*

**Good morning respected professors.**

I am **22A91A61F9**, and I’ll begin by introducing our project **Entity** and the problem it addresses.

### 🔹 Problem Overview

In many academic and organizational environments, documents such as request letters, approvals, certificates, and reports are reused frequently with only small changes in details like dates, names, venues, or amounts.

Currently, this process is mostly manual, repetitive, and error-prone. Even simple changes often lead to formatting issues and inconsistencies across documents.

### 🔹 Objective of Entity

The goal of **Entity** is to automate this repetitive document workflow using **AI**, while ensuring that:

* The document’s **format and layout are preserved**
* Variable content is **intelligently identified**
* Users can generate updated documents **quickly and reliably**

### 🔹 Scope

Entity focuses on:

* DOCX-based documents
* Event-based organization of templates
* AI-assisted variable extraction
* Secure, user-specific document management

The system is not a general-purpose editor, but a **document automation platform** designed for repeatable workflows.

---

## 👤 Student 2: **22A91A6188**

### *(Literature Survey, Research Gap, Core Idea)*

**Good morning professors, I am 22A91A6188. I will explain the research background and technical motivation behind Entity.**

### 🔹 Literature Survey Summary

We studied existing work in:

* Document automation systems
* Template-based document generation
* AI and LLM-based document editing
* Multi-agent document processing systems

Most traditional systems rely on **predefined placeholders**, such as mail-merge templates.

Recent research shows that **Large Language Models** can understand document structure and extract information from unstructured text. However, most research prototypes:

* Do not preserve DOCX formatting reliably
* Focus on content generation, not document operations
* Require heavy manual template preparation

### 🔹 Identified Research Gap

From the literature, we identified clear gaps:

* No intelligent system that **automatically detects replaceable variables** from raw DOCX documents
* Poor handling of **format-preserving text replacement**
* Limited focus on **end-to-end document workflows**
* Lack of user-friendly systems that combine AI understanding with real document integrity

### 🔹 How Entity Addresses This Gap

Entity bridges this gap by:

* Converting DOCX → Markdown for AI understanding
* Using LLMs to **suggest variables dynamically**
* Allowing user verification and mapping
* Performing **advanced DOCX replacements across runs, tables, and text boxes**

This makes Entity both **research-driven and practically usable**.

---

## 👤 Student 3: **22A91A61A4**

### *(Methodology, Architecture, Requirements)*

**Good morning, I am 22A91A61A4. I will explain the methodology and system setup.**

### 🔹 Methodology

The system follows a structured pipeline:

1. User authentication using Supabase
2. Event creation and document upload
3. DOCX to Markdown conversion
4. AI-based variable extraction using LLMs
5. User mapping of variables
6. Format-preserving replacement in DOCX
7. Final document generation and download

### 🔹 Architecture Overview

* **Frontend**: React 19 with Tailwind CSS
* **Backend**: FastAPI (Python)
* **AI Layer**: LangChain + Groq Llama 3.1
* **Database & Auth**: Supabase (PostgreSQL)
* **Storage**: User-isolated cloud storage

### 🔹 Hardware Requirements

* Intel i5 or equivalent
* Minimum 8 GB RAM
* Stable internet connection

  Since it is web-based, no high-end client hardware is required.

### 🔹 Software Requirements

* React, Vite, Tailwind
* FastAPI, Python 3.10+
* LangChain, python-docx
* Supabase, Git, Node.js

---

## 👤 Student 4: **22A91A61F2**

### *(Comparison, Challenges, Conclusion)*

**Good morning professors, I am 22A91A61F2. I will conclude with comparison and challenges.**

### 🔹 Existing System vs Entity

**Existing System**

* Manual editing
* High error rate
* Formatting often breaks
* Time-consuming

**Our System – Entity**

* AI-assisted variable detection
* Automated document generation
* Formatting preserved
* Faster, consistent, scalable

### 🔹 Challenges Faced

* Preserving formatting across DOCX runs and tables
* Ensuring consistent AI outputs
* Handling large documents efficiently
* Maintaining strict user data isolation

Each of these challenges was addressed through structured prompts, careful DOCX processing, and secure backend design.

### 🔹 Conclusion

Entity transforms document handling from a manual task into an **intelligent, automated workflow**.

It combines AI understanding with real-world document constraints, making it suitable for academic, institutional, and organizational use cases.

**Thank you. We are happy to answer your questions.**

---

## 🧠 Pro Tip for Viva

If asked **“Who did what?”**

👉 Say **22A91A6188 handled core architecture, AI workflow, and document processing logic**, others supported frontend, testing, documentation, and integration.

Based on the **research we discussed**, the **most suitable base paper** for **Project Entity** is the following:

---

## ✅ **Selected Base Paper**

### **“LLM-Based Multi-Agent Generation of Semi-Structured Documents in the Public Administration Domain”**

**Authors:** E. Musumeci et al.

**Year & Source:** 2024, HCII Conference (Springer / arXiv)

---

## 🔍 Why this paper is the best base for *Entity*

This paper aligns with Entity at a **conceptual and architectural level**

### 1. Strong Conceptual Match

The paper focuses on:

* Semi-structured documents
* Automated document generation
* Use of **LLMs to understand document content**
* Workflow-oriented document creation

Entity similarly:

* Works on semi-structured DOCX documents
* Uses LLMs to understand document content
* Automates document generation for real workflows (events)

So the **problem space is the same**.

---

### 2. Clear Research Lineage (Entity Extends It)

The base paper:

* Uses **LLMs to fill document templates**
* Relies on predefined structure
* Focuses on content generation

Entity **extends this idea** by:

* Automatically extracting variables from raw DOCX (no predefined placeholders)
* Preserving DOCX formatting at the run/table/text-box level
* Providing an end-to-end, user-facing system

This makes Entity a **natural continuation**, not a copy.

---

### 3. Clean Research Gap to Claim

You can clearly say:

> “While the base paper focuses on LLM-based document generation using predefined semi-structured templates, our work extends this approach by enabling AI-driven variable discovery from unstructured DOCX documents and performing formatting-preserving replacements in real-world document workflows.”

That sentence is gold in reviews.

---

## 🧾 How to Write This in Your Report / PPT

You can include this line:

> **Base Paper:**

> *“LLM-Based Multi-Agent Generation of Semi-Structured Documents in the Public Administration Domain” (Musumeci et al., 2024)*

> *Our project Entity builds upon this work by extending AI-assisted document generation to unstructured DOCX templates, introducing automatic variable extraction, formatting-preserving replacement, and an end-to-end document automation workflow.*
>
