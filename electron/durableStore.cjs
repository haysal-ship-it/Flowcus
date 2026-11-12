/**
 * Durable State & Storage Foundation (W03)
 * Provides versioned schemas, atomic file replacement, serialized writes,
 * last-known-good backup recovery, and idempotent legacy migration.
 */

const fs = require('fs');
const path = require('path');

const CURRENT_SCHEMA_VERSION = 1;

/**
 * Default clean state envelope for Uwidgets desktop.
 */
function getDefaultState() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    revision: 1,
    migrationMarkers: {},
    desktop: {
      pinned: { flowcus: false, playz: false, stickk: false },
      restoreOnStartup: { flowcus: false, playz: false, stickk: false },
      open: { flowcus: false, playz: false, stickk: false }, // Backwards compatibility
      positions: {},
      scaleFactor: 1.0,
      startWithWindows: false,
      startMinimized: false,
      soundEffects: true,
      alwaysOnTopDefault: false,
      closeToTray: true,
      accentColor: '#D05300',
    },
    tasks: [],
    stickkPages: [],
    stickkTrash: [],
  };
}

/**
 * Validates state schema and version boundaries.
 */
function validateSchema(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, code: 'INVALID_OBJECT', reason: 'State must be a non-null object' };
  }

  // Version boundary check
  const version = data.schemaVersion;
  if (typeof version === 'number' && version > CURRENT_SCHEMA_VERSION) {
    return {
      valid: false,
      code: 'UNSUPPORTED_NEWER_VERSION',
      version,
      reason: `State schema version ${version} is newer than supported version ${CURRENT_SCHEMA_VERSION}`,
    };
  }

  if (!data.desktop || typeof data.desktop !== 'object') {
    return { valid: false, code: 'INVALID_DESKTOP', reason: 'Missing or invalid desktop settings object' };
  }

  return { valid: true };
}

/**
 * Migrates unversioned legacy desktop state (from W00-W02) to versioned envelope.
 * Preserves all IDs, positions, scale, settings, and restoration intent.
 */
function migrateLegacyState(legacyData) {
  const defaultEnvelope = getDefaultState();

  // If already at current schema, return as-is
  if (legacyData.schemaVersion === CURRENT_SCHEMA_VERSION) {
    return legacyData;
  }

  const legacyOpen = legacyData.open || {};
  const legacyRestore = legacyData.restoreOnStartup || legacyOpen;

  const migrated = {
    ...defaultEnvelope,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    revision: (legacyData.revision || 0) + 1,
    migrationMarkers: {
      ...(legacyData.migrationMarkers || {}),
      v1_desktop_state_migrated: new Date().toISOString(),
    },
    desktop: {
      pinned: {
        flowcus: Boolean(legacyData.pinned?.flowcus),
        playz: Boolean(legacyData.pinned?.playz),
        stickk: Boolean(legacyData.pinned?.stickk),
      },
      restoreOnStartup: {
        flowcus: Boolean(legacyRestore.flowcus),
        playz: Boolean(legacyRestore.playz),
        stickk: Boolean(legacyRestore.stickk),
      },
      open: {
        flowcus: Boolean(legacyRestore.flowcus),
        playz: Boolean(legacyRestore.playz),
        stickk: Boolean(legacyRestore.stickk),
      },
      positions: legacyData.positions && typeof legacyData.positions === 'object' ? { ...legacyData.positions } : {},
      scaleFactor: typeof legacyData.scaleFactor === 'number' ? legacyData.scaleFactor : 1.0,
      startWithWindows: Boolean(legacyData.startWithWindows),
      startMinimized: Boolean(legacyData.startMinimized),
      soundEffects: legacyData.soundEffects !== false,
      alwaysOnTopDefault: Boolean(legacyData.alwaysOnTopDefault),
      closeToTray: legacyData.closeToTray !== false,
      accentColor: typeof legacyData.accentColor === 'string' ? legacyData.accentColor : '#D05300',
    },
    tasks: Array.isArray(legacyData.tasks) ? legacyData.tasks : [],
    stickkPages: Array.isArray(legacyData.stickkPages) ? legacyData.stickkPages : [],
    stickkTrash: Array.isArray(legacyData.stickkTrash) ? legacyData.stickkTrash : [],
  };

  return migrated;
}

/**
 * Windows-compatible atomic file replacement using temporary file in same directory.
 * Flushes buffers with fsyncSync and retries on transient Windows file lock contention.
 */
function atomicWriteFileSync(filePath, contentString) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Temporary file in the exact same directory ensures rename stays within the same filesystem mount
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, contentString, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // Atomic replacement with retry loop for Windows EPERM / EBUSY
  let replaced = false;
  let lastErr = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmpPath, filePath);
      replaced = true;
      break;
    } catch (err) {
      lastErr = err;
      if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EEXIST') {
        // Spin briefly to allow external file locks (e.g. antivirus/indexer) to clear
        const waitMs = (attempt + 1) * 15;
        const start = Date.now();
        while (Date.now() - start < waitMs) {
          // sync pause
        }
      } else {
        break;
      }
    }
  }

  if (!replaced) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {}
    throw lastErr || new Error(`Failed to atomically replace ${filePath}`);
  }
}

/**
 * DurableStore: Manages persistence, serialized writes, backups, and recovery.
 */
class DurableStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.backupPath = `${filePath}.bak`;
    this.preMigrationPath = `${filePath}.pre-migration.bak`;
    this.state = null;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Loads state from primary file or recovers from backup if primary is corrupt.
   * Never overwrites recoverable data.
   */
  load() {
    // Case 1: Primary file exists
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);

        // Check for unsupported newer version
        if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
          return {
            success: false,
            code: 'UNSUPPORTED_NEWER_VERSION',
            version: parsed.schemaVersion,
            filePath: this.filePath,
            message: `File version ${parsed.schemaVersion} is newer than application version ${CURRENT_SCHEMA_VERSION}. Load aborted to protect data.`,
          };
        }

        // Check if migration is needed (legacy unversioned or older schema)
        if (!parsed.schemaVersion || parsed.schemaVersion < CURRENT_SCHEMA_VERSION) {
          // 1. Back up unmigrated raw file
          try {
            fs.copyFileSync(this.filePath, this.preMigrationPath);
          } catch (e) {
            console.warn('Failed to create pre-migration backup:', e);
          }

          // 2. Migrate data cleanly
          const migrated = migrateLegacyState(parsed);

          // 3. Commit migrated data atomically
          atomicWriteFileSync(this.filePath, JSON.stringify(migrated, null, 2));
          try {
            fs.copyFileSync(this.filePath, this.backupPath);
          } catch {}

          this.state = migrated;
          return { success: true, state: migrated, migrated: true };
        }

        // Schema version 1: validate structure
        const val = validateSchema(parsed);
        if (!val.valid) {
          throw new Error(`Schema validation error: ${val.reason}`);
        }

        // Ensure backup is present and up-to-date
        try {
          fs.copyFileSync(this.filePath, this.backupPath);
        } catch {}

        this.state = parsed;
        return { success: true, state: parsed };
      } catch (err) {
        console.error('Primary state file corrupted or unreadable. Attempting backup recovery...', err);

        // Preserve corrupted primary file so user bytes are never lost
        const corruptPath = `${this.filePath}.corrupt.${Date.now()}`;
        try {
          fs.copyFileSync(this.filePath, corruptPath);
        } catch {}

        // Attempt recovery from .bak
        if (fs.existsSync(this.backupPath)) {
          try {
            const rawBackup = fs.readFileSync(this.backupPath, 'utf8');
            const parsedBackup = JSON.parse(rawBackup);
            const backupVal = validateSchema(parsedBackup);

            if (backupVal.valid) {
              // Recover primary from valid backup
              atomicWriteFileSync(this.filePath, JSON.stringify(parsedBackup, null, 2));
              this.state = parsedBackup;
              return {
                success: true,
                state: parsedBackup,
                recoveredFromBackup: true,
                corruptPath,
              };
            }
          } catch (backupErr) {
            console.error('Backup file also corrupted:', backupErr);
          }
        }

        return {
          success: false,
          code: 'CORRUPT_PRIMARY_AND_BACKUP',
          corruptPath,
          message: 'Primary file was corrupted and no valid backup was available. Corrupted file preserved.',
        };
      }
    }

    // Case 2: Primary file missing, check backup
    if (fs.existsSync(this.backupPath)) {
      try {
        const rawBackup = fs.readFileSync(this.backupPath, 'utf8');
        const parsedBackup = JSON.parse(rawBackup);
        if (validateSchema(parsedBackup).valid) {
          atomicWriteFileSync(this.filePath, JSON.stringify(parsedBackup, null, 2));
          this.state = parsedBackup;
          return { success: true, state: parsedBackup, recoveredFromBackup: true };
        }
      } catch {}
    }

    // Case 3: Completely fresh initialization
    const freshState = getDefaultState();
    atomicWriteFileSync(this.filePath, JSON.stringify(freshState, null, 2));
    try {
      fs.copyFileSync(this.filePath, this.backupPath);
    } catch {}

    this.state = freshState;
    return { success: true, state: freshState, initializedNew: true };
  }

  /**
   * Enqueues an asynchronous write operation into a sequential promise chain (Mutex).
   * Guarantees concurrent saves execute sequentially without race conditions.
   */
  save(newState) {
    this.writeQueue = this.writeQueue
      .catch(() => {}) // Continue queue even if prior save failed
      .then(async () => {
        const val = validateSchema(newState);
        if (!val.valid) {
          throw new Error(`Cannot persist invalid state: ${val.reason || val.code}`);
        }

        // 1. Maintain last-known-good backup from existing file if valid
        if (fs.existsSync(this.filePath)) {
          try {
            fs.copyFileSync(this.filePath, this.backupPath);
          } catch (e) {
            console.warn('Failed to update backup file:', e);
          }
        }

        // 2. Increment monotonic revision and update timestamp
        const toSave = {
          ...newState,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          revision: (this.state?.revision || 0) + 1,
        };

        // 3. Atomically write to disk and update validated backup
        atomicWriteFileSync(this.filePath, JSON.stringify(toSave, null, 2));
        try {
          fs.copyFileSync(this.filePath, this.backupPath);
        } catch {}
        this.state = toSave;
        return toSave;
      });

    return this.writeQueue;
  }

  /**
   * Synchronous save fallback for application quit handlers where event loop is closing.
   */
  saveSync(newState) {
    const val = validateSchema(newState);
    if (!val.valid) {
      throw new Error(`Cannot persist invalid state: ${val.reason || val.code}`);
    }

    const toSave = {
      ...newState,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      revision: (this.state?.revision || 0) + 1,
    };

    atomicWriteFileSync(this.filePath, JSON.stringify(toSave, null, 2));
    try {
      fs.copyFileSync(this.filePath, this.backupPath);
    } catch {}
    this.state = toSave;
    return toSave;
  }
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  getDefaultState,
  validateSchema,
  migrateLegacyState,
  atomicWriteFileSync,
  DurableStore,
};
