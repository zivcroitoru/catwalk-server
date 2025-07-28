#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as readline from 'readline';

// Database configuration
const dbDetails = {
  label: "sprite-uris-neondb",
  host: "ep-wandering-dust-a2jd51zd-pooler.eu-central-1.aws.neon.tech",
  user: "neondb_owner",
  port: 5432,
  ssl: true,
  database: "neondb",
  password: "npg_xoNhIk3fqDK5"
};

// Images directory for item sprite previews
const imagesDir = 'C:\\Users\\peleg\\Downloads\\item-sprite_url_preview';

/**
 * Gets all PNG files from the directory
 */
function getPngFiles(directory: string): string[] {
  try {
    const files = fs.readdirSync(directory);
    return files.filter(file => file.toLowerCase().endsWith('.png'));
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
    return [];
  }
}

/**
 * Extracts sequence number from filename
 */
function extractSequence(filename: string): string | null {
  const match = filename.match(/item-sprite_url_preview-(\d{3})\.png$/i);
  return match ? match[1] : null;
}

/**
 * Maps sequence number to actual template name
 */
function sequenceToTemplateName(sequence: string): string | null {
  const seqNum = parseInt(sequence, 10);
  
  // Mapping based on the database order (1-37)
  const mappings: { [key: number]: string } = {
    1: 'dark_blue_bowtie_001',
    2: 'fishing_hook_001', 
    3: 'gold_blue_necklace_001',
    4: 'light_necktie_001',
    5: 'pearl_necklace_001',
    6: 'red_bandana_001',
    7: 'angry_robot_eyes_blue_001',
    8: 'anime_eyes_blue_001',
    9: 'cartoon_eyes_blue_001',
    10: 'cartoon_eyes_plain_001',
    11: 'cat_eyes_blue_001',
    12: 'sad_tear_eyes_blue_001',
    13: 'sad_tear_eyes_plain_001',
    14: 'simple_angry_eyes_blue_001',
    15: 'simple_eyes_blue_001',
    16: 'cartman_beanie_001',
    17: 'cowboy_hat_001',
    18: 'jester_hat_001',
    19: 'mushroom_hat_001',
    20: 'pink_ear_bow_001',
    21: 'sonic_hat_001',
    22: 'sophie_straw_hat_001',
    23: 'witch_hat_001',
    24: 'howl_jacket_001',
    25: 'kenny_coat_001',
    26: 'ducktail_mustache_001',
    27: 'fu_manchu_001',
    28: 'handlebar_goatee_001',
    29: 'handlebar_mustache_001',
    30: 'long_ducktail_001',
    31: 'cheshire_onesie_001',
    32: 'flowy_cream_dress_001',
    33: 'groom_shirt_001',
    34: 'sunflower_shirt_001',
    35: 'vintage_brown_dress_001',
    36: 'wedding_dress_001',
    37: 'white_shirt_001'
  };

  return mappings[seqNum] || null;
}

/**
 * Converts image file to base64
 */
function imageToBase64(filePath: string): string {
  const imageBuffer = fs.readFileSync(filePath);
  return imageBuffer.toString('base64');
}

/**
 * Shows database summary for item templates
 */
async function showDatabaseSummary(client: Client): Promise<void> {
  console.log(`\n=== Database Summary for Item Templates ===`);
  
  // Summary query
  const summaryQuery = `
    SELECT 
      COUNT(*) as total_items,
      COUNT(sprite_url_preview) as have_sprite_url_preview,
      COUNT(*) - COUNT(sprite_url_preview) as missing_sprite_url_preview
    FROM itemtemplate
  `;
  
  try {
    const summaryResult = await client.query(summaryQuery);
    const summary = summaryResult.rows[0];
    
    console.log(`Total item templates: ${summary.total_items}`);
    console.log(`Have sprite URL preview: ${summary.have_sprite_url_preview}`);
    console.log(`Missing sprite URL preview: ${summary.missing_sprite_url_preview}`);
    
    // Detailed query by category
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as total,
        COUNT(sprite_url_preview) as have_preview,
        COUNT(*) - COUNT(sprite_url_preview) as missing_preview
      FROM itemtemplate 
      GROUP BY category
      ORDER BY category
    `;
    
    const categoryResult = await client.query(categoryQuery);
    
    console.log(`\n=== Summary by Category ===`);
    categoryResult.rows.forEach(row => {
      console.log(`${row.category}: ${row.have_preview}/${row.total} (${row.missing_preview} missing)`);
    });
    
    // Detailed query showing all items
    const detailQuery = `
      SELECT template, category, name,
             CASE WHEN sprite_url_preview IS NOT NULL THEN 'YES' ELSE 'NO' END as has_preview
      FROM itemtemplate 
      ORDER BY category, template
    `;
    
    const detailResult = await client.query(detailQuery);
    
    console.log(`\n=== Detailed Records ===`);
    let currentCategory = '';
    detailResult.rows.forEach(row => {
      if (row.category !== currentCategory) {
        currentCategory = row.category;
        console.log(`\n--- ${currentCategory.toUpperCase()} ---`);
      }
      console.log(`${row.template}: ${row.has_preview} (${row.name})`);
    });
    
  } catch (error) {
    console.error('Error querying database:', error);
  }
}

/**
 * Waits for user input
 */
function waitForUserInput(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\nPress Enter to continue with updates (or Ctrl+C to abort): ', () => {
      rl.close();
      resolve();
    });
  });
}

/**
 * Updates database with image data
 */
async function updateDatabase(client: Client, updates: Array<{template: string, imagePath: string}>): Promise<void> {
  console.log(`\n=== Starting Database Updates ===`);
  
  let successCount = 0;
  let notFoundCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    try {
      console.log(`Processing: ${path.basename(update.imagePath)} -> ${update.template}`);
      
      const base64Data = imageToBase64(update.imagePath);
      const dataUri = `data:image/png;base64,${base64Data}`;
      
      const updateQuery = `
        UPDATE itemtemplate 
        SET sprite_url_preview = $1,
            last_updated_at = CURRENT_TIMESTAMP
        WHERE template = $2
      `;
      
      const result = await client.query(updateQuery, [dataUri, update.template]);
      
      if (result.rowCount === 0) {
        console.log(`  ⚠️  No rows updated for ${update.template} - template may not exist in database`);
        notFoundCount++;
      } else {
        console.log(`  ✅ Updated ${update.template}`);
        successCount++;
      }
      
    } catch (error) {
      console.error(`  ❌ Error updating ${update.template}:`, error);
      errorCount++;
    }
  }
  
  console.log(`\n=== Update Summary ===`);
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`⚠️  Templates not found: ${notFoundCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log(`Processing item template sprite previews`);
    console.log(`Images directory: ${imagesDir}`);
    
    // Check if directory exists
    if (!fs.existsSync(imagesDir)) {
      console.error(`Directory does not exist: ${imagesDir}`);
      console.log('Please create the directory and add your PNG files.');
      return;
    }
    
    // Get PNG files
    const pngFiles = getPngFiles(imagesDir);
    console.log(`Found ${pngFiles.length} PNG files`);
    
    if (pngFiles.length === 0) {
      console.log('No PNG files found. Exiting.');
      return;
    }
    
    // Process files and create update list
    const updates: Array<{template: string, imagePath: string}> = [];
    
    console.log(`\n=== File Processing ===`);
    for (const filename of pngFiles) {
      const sequence = extractSequence(filename);
      if (!sequence) {
        console.log(`Skipping ${filename} - couldn't extract sequence number`);
        continue;
      }
      
      const template = sequenceToTemplateName(sequence);
      if (!template) {
        console.log(`Skipping ${filename} - no mapping found for sequence ${sequence}`);
        continue;
      }
      
      const fullPath = path.join(imagesDir, filename);
      
      updates.push({ template, imagePath: fullPath });
      console.log(`Mapped: ${filename} (${sequence}) -> template: ${template}`);
    }
    
    console.log(`\nPrepared ${updates.length} updates`);
    
    // Connect to database
    const client = new Client(dbDetails);
    await client.connect();
    console.log('Connected to database');
    
    try {
      // Show database summary
      await showDatabaseSummary(client);
      
      // Wait for user confirmation
      await waitForUserInput();
      
      // Perform updates
      await updateDatabase(client, updates);
      
      // Show final summary
      console.log(`\n=== Final Summary ===`);
      await showDatabaseSummary(client);
      
    } finally {
      await client.end();
      console.log('Database connection closed');
    }
    
  } catch (error) {
    console.error('Error in main execution:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().then(() => {
    console.log('Script completed successfully');
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}