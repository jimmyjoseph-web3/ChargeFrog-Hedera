const { ethers } = require('ethers');

function normalizePrivateKey(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('0x')) return trimmed;
  return /^[A-Fa-f0-9]{64}$/.test(trimmed) ? `0x${trimmed}` : trimmed;
}

function createPrivateKeySigner({ privateKey, rpcUrl }) {
  const normalizedPrivateKey = normalizePrivateKey(privateKey);
  if (!normalizedPrivateKey) {
    throw new Error('ADMIN_PRIVATE_KEY is required');
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(normalizedPrivateKey, provider);

  return { wallet, provider, address: wallet.address };
}

module.exports = {
  normalizePrivateKey,
  createPrivateKeySigner,
};
