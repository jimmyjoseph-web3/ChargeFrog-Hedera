const fs = require('fs');
const path = require('path');

const promptCache = new Map();

function loadTemplate(filePath) {
  const resolved = path.resolve(filePath);
  if (!promptCache.has(resolved)) {
    promptCache.set(
      resolved,
      fs.readFileSync(resolved, 'utf8').replace(/\r\n/g, '\n').trim(),
    );
  }
  return promptCache.get(resolved);
}

function interpolateTemplate(template, variables = {}) {
  const resolved = String(template || '').replace(
    /\{\{\s*([A-Z0-9_]+)\s*\}\}/g,
    (match, key) => {
      if (!Object.prototype.hasOwnProperty.call(variables, key)) {
        throw new Error(`Missing prompt variable: ${key}`);
      }
      return String(variables[key]);
    },
  );

  const unresolved = resolved.match(/\{\{\s*([A-Z0-9_]+)\s*\}\}/);
  if (unresolved) {
    throw new Error(`Unresolved prompt variable: ${unresolved[1]}`);
  }

  return resolved.trim();
}

function loadMarkdownPrompt(filePath, variables = {}) {
  const template = loadTemplate(filePath);
  return interpolateTemplate(template, variables);
}

module.exports = {
  loadMarkdownPrompt,
};
