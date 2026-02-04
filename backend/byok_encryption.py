"""
BYOK Encryption Layer - AES-256-GCM Implementation
Handles secure encryption/decryption of API keys
"""
import os
import base64
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag
from dotenv import load_dotenv

load_dotenv(override=True)

class BYOKEncryption:
    def __init__(self):
        # Load master key from environment
        master_key_b64 = os.getenv('BYOK_MASTER_KEY')
        if not master_key_b64:
            raise ValueError("BYOK_MASTER_KEY environment variable not set")
        
        try:
            self.master_key = base64.b64decode(master_key_b64)
            if len(self.master_key) != 32:  # 256 bits
                raise ValueError("Master key must be 32 bytes (256 bits)")
        except Exception as e:
            raise ValueError(f"Invalid BYOK_MASTER_KEY format: {e}")
        
        self.aesgcm = AESGCM(self.master_key)
    
    def encrypt_api_key(self, raw_key: str) -> str:
        """Encrypt API key using AES-256-GCM"""
        if not raw_key or not raw_key.strip():
            raise ValueError("API key cannot be empty")
        
        # Generate random nonce (96-bit for GCM)
        nonce = os.urandom(12)
        
        # Encrypt the key
        ciphertext = self.aesgcm.encrypt(nonce, raw_key.encode('utf-8'), None)
        
        # Combine nonce + ciphertext and encode as base64
        encrypted_data = nonce + ciphertext
        return base64.b64encode(encrypted_data).decode('utf-8')
    
    def decrypt_api_key(self, encrypted_key: str) -> str:
        """Decrypt API key using AES-256-GCM"""
        try:
            # Decode from base64
            encrypted_data = base64.b64decode(encrypted_key.encode('utf-8'))
            
            # Extract nonce and ciphertext
            nonce = encrypted_data[:12]
            ciphertext = encrypted_data[12:]
            
            # Decrypt
            plaintext = self.aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode('utf-8')
        
        except (InvalidTag, ValueError, Exception) as e:
            raise ValueError(f"Failed to decrypt API key: {e}")
    
    def fingerprint_api_key(self, raw_key: str) -> str:
        """Generate SHA-256 fingerprint of API key (first 16 chars)"""
        if not raw_key:
            raise ValueError("API key cannot be empty")
        
        hash_obj = hashlib.sha256(raw_key.encode('utf-8'))
        return hash_obj.hexdigest()[:16]

# Global instance
byok_crypto = BYOKEncryption()