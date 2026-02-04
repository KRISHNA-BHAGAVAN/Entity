#!/usr/bin/env python3
"""
BYOK Setup Script
Generates a secure master key for API key encryption
"""
import os
import base64
import secrets

def generate_master_key():
    """Generate a secure 256-bit master key"""
    # Generate 32 random bytes (256 bits)
    key_bytes = secrets.token_bytes(32)
    
    # Encode as base64 for environment variable storage
    key_b64 = base64.b64encode(key_bytes).decode('utf-8')
    
    return key_b64

def main():
    print("🔐 BYOK Master Key Generator")
    print("=" * 40)
    
    # Generate new master key
    master_key = generate_master_key()
    
    print(f"Generated master key: {master_key}")
    print()
    print("Add this to your .env file:")
    print(f"BYOK_MASTER_KEY={master_key}")
    print()
    print("⚠️  IMPORTANT SECURITY NOTES:")
    print("• Store this key securely - losing it means losing access to all encrypted API keys")
    print("• Never commit this key to version control")
    print("• Use different keys for development and production")
    print("• Consider using a key management service in production")

if __name__ == "__main__":
    main()