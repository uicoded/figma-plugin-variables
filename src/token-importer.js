/**
 * Figma Variable Token Importer
 *
 * Usage: Run this function in the browser console while Figma is open
 * Example: importTokensToFigma(exampleColorTokens);
 *
 * @param {Object} tokensData - Object containing token data
 * @param {string} tokensData.title - Collection title
 * @param {string} tokensData.description - Collection description
 * @param {Array} tokensData.items - Array of token items
 * @param {string} tokensData.items[].name - Token name
 * @param {string} tokensData.items[].value - Token value (hex color, number, etc.)
 */
async function importTokensToFigma(tokensData) {
  try {
    // Check if we're in Figma environment
    if (typeof figma === 'undefined') {
      throw new Error('This function must be run in Figma. Please open Figma and run this in the browser console.');
    }

    // Validate input data
    if (!tokensData || !tokensData.items || !Array.isArray(tokensData.items)) {
      throw new Error('Invalid token data. Expected object with "items" array.');
    }

    const { title = 'Imported Tokens', description = '', items } = tokensData;

    // Create or get variable collection
    let collection;
    const existingCollections = figma.variables.getLocalVariableCollections();
    const existingCollection = existingCollections.find(col => col.name === title);

    if (existingCollection) {
      collection = existingCollection;
      console.log(`Using existing collection: ${title}`);
    } else {
      collection = figma.variables.createVariableCollection(title);
      console.log(`Created new collection: ${title}`);
    }

    // Set collection description if provided
    if (description) {
      collection.description = description;
    }

    // Get the default mode
    const defaultMode = collection.modes[0];

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each token
    for (const item of items) {
      try {
        const { name, value } = item;

        if (!name || value === undefined) {
          errors.push(`Skipped item: missing name or value - ${JSON.stringify(item)}`);
          skippedCount++;
          continue;
        }

        // Clean up variable name (Figma has naming restrictions)
        const variableName = name.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
        if (!variableName) {
          errors.push(`Skipped item: invalid name after cleanup - ${name}`);
          skippedCount++;
          continue;
        }

        // Check if variable already exists
        const existingVariables = collection.variableIds.map(id => figma.variables.getVariableById(id));
        const existingVariable = existingVariables.find(v => v && v.name === variableName);

        // Determine variable type and process value first
        let variableType = 'STRING'; // default
        let processedValue = value;

        if (typeof value === 'string' && value.startsWith('#')) {
          // Hex color
          variableType = 'COLOR';
          processedValue = hexToRgb(value);
        } else if (typeof value === 'number') {
          variableType = 'FLOAT';
          processedValue = value;
        } else if (typeof value === 'boolean') {
          variableType = 'BOOLEAN';
          processedValue = value;
        } else {
          // Keep as string
          processedValue = String(value);
        }

        let variable;
        if (existingVariable) {
          variable = existingVariable;
          console.log(`Updating existing variable: ${variableName}`);
        } else {
          variable = figma.variables.createVariable(variableName, collection, variableType);
          console.log(`Created new variable: ${variableName} (${variableType})`);
        }

        // Set the variable value for the default mode
        let finalValue = processedValue;

        // Handle color conversion for existing variables that might have different types
        if (variable.resolvedType === 'COLOR' && typeof value === 'string' && value.startsWith('#')) {
          finalValue = hexToRgb(value);
        } else if (variable.resolvedType === 'COLOR' && typeof processedValue === 'object') {
          finalValue = processedValue;
        } else {
          finalValue = processedValue;
        }

        variable.setValueForMode(defaultMode.modeId, finalValue);
        importedCount++;

      } catch (itemError) {
        errors.push(`Error processing item "${item.name || 'unknown'}": ${itemError.message}`);
        skippedCount++;
      }
    }

    // Report results
    console.log(`\n=== Import Results ===`);
    console.log(`Collection: ${title}`);
    console.log(`Successfully imported: ${importedCount} variables`);
    console.log(`Skipped: ${skippedCount} items`);

    if (errors.length > 0) {
      console.log(`\nErrors/Warnings:`);
      errors.forEach(error => console.warn(error));
    }

    // Notify user in Figma
    figma.notify(`Imported ${importedCount} variables to "${title}" collection`);

    return {
      success: true,
      collection,
      imported: importedCount,
      skipped: skippedCount,
      errors
    };

  } catch (error) {
    console.error('Failed to import tokens:', error);
    if (typeof figma !== 'undefined') {
      figma.notify(`Import failed: ${error.message}`, { error: true });
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper function to convert hex color to RGB object
 * @param {string} hex - Hex color string (e.g., "#FF0000")
 * @returns {Object} RGB object with r, g, b values (0-1 range)
 */
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace('#', '');

  // Handle 3-character hex
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }

  if (hex.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  return { r, g, b };
}

/**
 * Example usage with your color tokens:
 */
const exampleColorTokens = {
  "title": "UX-Ops Colors",
  "description": "Hex color codes that can be shared, cross-platform.",
  "items": [
    {
      "name": "Charcoal Black",
      "value": "#232323"
    },
    {
      "name": "Primary Blue",
      "value": "#007AFF"
    },
    {
      "name": "Success Green",
      "value": "#34C759"
    },
    {
      "name": "Warning Orange",
      "value": "#FF9500"
    },
    {
      "name": "Error Red",
      "value": "#FF3B30"
    }
  ]
};

// Uncomment to run with example data:
// importTokensToFigma(exampleColorTokens);

console.log('Figma Token Importer loaded! Use importTokensToFigma(yourTokenData) to import variables.');
