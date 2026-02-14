import fs from 'fs/promises';
import path from 'path';
import { constants as fsConstants } from 'fs';

// Allowed base paths for file access
const ALLOWED_BASE_PATHS = [
  process.env.HERIKA_SERVER_PATH || '/var/www/html/HerikaServer',
  '/home/dwemer',
];

// Blocked binary file extensions and directories
const BLOCKED_EXTENSIONS = [
  '.wav', '.mp3', '.mp4', '.avi', '.mov', '.flac', '.ogg', '.aac',
  '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
  '.pt', '.pth', '.onnx', '.pkl', '.pickle', '.safetensors', '.ckpt',
  '.exe', '.dll', '.so', '.dylib',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
];

const BLOCKED_DIRECTORIES = ['node_modules', '.git', '__pycache__', '.venv', 'venv'];

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_LIST_ENTRIES = 500;
const MAX_SEARCH_MATCHES = 100;
const MAX_SEARCH_FILE_SIZE = 512 * 1024; // 512KB
const MAX_RECURSIVE_DEPTH = 3;

/**
 * Validate and resolve a path, ensuring it's within allowed base paths
 */
async function validatePath(inputPath: string): Promise<string> {
  // Resolve to absolute path
  const resolvedPath = path.resolve(inputPath);
  
  // Check if path is within any allowed base path
  const isAllowed = ALLOWED_BASE_PATHS.some(basePath => {
    const resolvedBase = path.resolve(basePath);
    return resolvedPath === resolvedBase || resolvedPath.startsWith(resolvedBase + path.sep);
  });
  
  if (!isAllowed) {
    throw new Error(`Access denied: path ${inputPath} is outside allowed directories`);
  }
  
  // Verify path exists
  try {
    await fs.access(resolvedPath, fsConstants.R_OK);
  } catch (error) {
    throw new Error(`Path not accessible: ${inputPath}`);
  }
  
  return resolvedPath;
}

/**
 * Check if file extension is blocked
 */
function isBlockedExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BLOCKED_EXTENSIONS.includes(ext);
}

/**
 * Check if directory name is blocked
 */
function isBlockedDirectory(dirName: string): boolean {
  return BLOCKED_DIRECTORIES.includes(dirName);
}

// Tool definitions
export const readFileTool = {
  name: 'read_file',
  description: 'Read contents of a file from HerikaServer or service directories. Cannot read binary files or files larger than 1MB.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'File path (absolute or relative to allowed base directories)',
      },
    },
    required: ['path'],
  },
};

export const listFilesTool = {
  name: 'list_files',
  description: 'List files and directories in a given path. Can list recursively up to 3 levels deep.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      directory: {
        type: 'string',
        description: 'Directory path to list',
      },
      recursive: {
        type: 'boolean',
        description: 'Whether to list recursively (max depth 3)',
        default: false,
      },
    },
    required: ['directory'],
  },
};

export const searchFilesTool = {
  name: 'search_files',
  description: 'Search for files by name pattern (glob) and optionally search content by keyword.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      directory: {
        type: 'string',
        description: 'Directory to search in',
      },
      pattern: {
        type: 'string',
        description: 'Filename pattern (glob, e.g., "*.php", "config*")',
      },
      keyword: {
        type: 'string',
        description: 'Optional keyword to search within file contents',
      },
    },
    required: ['directory', 'pattern'],
  },
};

// Tool handlers
export interface ReadFileParams {
  path: string;
}

export async function readFile(params: ReadFileParams): Promise<unknown> {
  const validatedPath = await validatePath(params.path);
  
  // Check if file is blocked
  if (isBlockedExtension(validatedPath)) {
    throw new Error(`Cannot read file with blocked extension: ${path.extname(validatedPath)}`);
  }
  
  // Check file size
  const stats = await fs.stat(validatedPath);
  
  if (!stats.isFile()) {
    throw new Error(`Path is not a file: ${params.path}`);
  }
  
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stats.size} bytes (max ${MAX_FILE_SIZE})`);
  }
  
  // Read file content
  const content = await fs.readFile(validatedPath, 'utf-8');
  
  return {
    path: validatedPath,
    size: stats.size,
    content,
  };
}

export interface ListFilesParams {
  directory: string;
  recursive?: boolean;
}

async function listFilesRecursive(
  dir: string,
  recursive: boolean,
  depth: number = 0,
  results: Array<{ name: string; type: string; size: number; path: string }> = []
): Promise<Array<{ name: string; type: string; size: number; path: string }>> {
  if (depth > MAX_RECURSIVE_DEPTH) {
    return results;
  }
  
  if (results.length >= MAX_LIST_ENTRIES) {
    return results;
  }
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (results.length >= MAX_LIST_ENTRIES) {
      break;
    }
    
    // Skip blocked directories
    if (entry.isDirectory() && isBlockedDirectory(entry.name)) {
      continue;
    }
    
    const fullPath = path.join(dir, entry.name);
    const stats = await fs.stat(fullPath);
    
    results.push({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      path: fullPath,
    });
    
    // Recurse into subdirectories
    if (recursive && entry.isDirectory()) {
      await listFilesRecursive(fullPath, recursive, depth + 1, results);
    }
  }
  
  return results;
}

export async function listFiles(params: ListFilesParams): Promise<unknown> {
  const validatedPath = await validatePath(params.directory);
  
  const stats = await fs.stat(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${params.directory}`);
  }
  
  const files = await listFilesRecursive(validatedPath, params.recursive || false);
  
  return {
    directory: validatedPath,
    recursive: params.recursive || false,
    count: files.length,
    files,
  };
}

export interface SearchFilesParams {
  directory: string;
  pattern: string;
  keyword?: string;
}

function matchesGlob(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  const regex = new RegExp(`^${regexPattern}$`, 'i');
  return regex.test(filename);
}

async function searchInDirectory(
  dir: string,
  pattern: string,
  keyword: string | undefined,
  results: Array<{ path: string; line?: number; content?: string }> = []
): Promise<Array<{ path: string; line?: number; content?: string }>> {
  if (results.length >= MAX_SEARCH_MATCHES) {
    return results;
  }
  
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (results.length >= MAX_SEARCH_MATCHES) {
      break;
    }
    
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip blocked directories
      if (isBlockedDirectory(entry.name)) {
        continue;
      }
      
      // Recurse into subdirectory
      await searchInDirectory(fullPath, pattern, keyword, results);
    } else {
      // Check if filename matches pattern
      if (matchesGlob(entry.name, pattern)) {
        // If no keyword search, just add the match
        if (!keyword) {
          results.push({ path: fullPath });
          continue;
        }
        
        // Skip binary files for content search
        if (isBlockedExtension(fullPath)) {
          continue;
        }
        
        // Check file size for content search
        try {
          const stats = await fs.stat(fullPath);
          if (stats.size > MAX_SEARCH_FILE_SIZE) {
            continue;
          }
          
          // Search content for keyword
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
              results.push({
                path: fullPath,
                line: i + 1,
                content: lines[i].trim(),
              });
              
              if (results.length >= MAX_SEARCH_MATCHES) {
                break;
              }
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }
  }
  
  return results;
}

export async function searchFiles(params: SearchFilesParams): Promise<unknown> {
  const validatedPath = await validatePath(params.directory);
  
  const stats = await fs.stat(validatedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${params.directory}`);
  }
  
  const matches = await searchInDirectory(validatedPath, params.pattern, params.keyword);
  
  return {
    directory: validatedPath,
    pattern: params.pattern,
    keyword: params.keyword,
    count: matches.length,
    matches,
  };
}
