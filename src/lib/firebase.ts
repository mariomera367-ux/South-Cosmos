import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

// Prueba inicial de conexión a Firestore recomendada
void (async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore unreachable / offline.');
    }
  }
})();

export interface FirestoreWhitelistItem {
  id: string;
  domain: string;
  label: string;
  category: 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial';
  active: boolean;
  ownerUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FirestoreKnowledgeEntry {
  id: string;
  ownerUid: string;
  tipo: 'clima' | 'similitud';
  sitio: string;
  sourceUrl: string;
  sourceDomain: string;
  whitelisted: boolean;
  autoApproved: boolean;
  verifiedBySearch: boolean;
  verificationSummary: string;
  status: 'aprobado' | 'pendiente' | 'rechazado';
  temperatura: number;
  presion: number;
  viento: number;
  luz: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function sanitizeDocId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || `id_${Date.now()}`;
}

export async function iniciarSesionGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, provider);
  const u = cred.user;
  if (u && u.emailVerified) {
    const userPath = `users/${u.uid}`;
    try {
      await setDoc(
        doc(db, 'users', u.uid),
        {
          uid: u.uid,
          email: (u.email || `${u.uid}@local.invalid`).slice(0, 256),
          displayName: (u.displayName || u.email || 'Investigador').slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Si el usuario ya existe, evitar error de mutación de createdAt
      try {
        await updateDoc(doc(db, 'users', u.uid), {
          email: (u.email || `${u.uid}@local.invalid`).slice(0, 256),
          displayName: (u.displayName || u.email || 'Investigador').slice(0, 120),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('No se pudo sincronizar perfil en users:', userPath, err);
      }
    }
  }
  return u;
}

export async function cerrarSesionGoogle(): Promise<void> {
  await signOut(auth);
}

export async function guardarDominioFirestore(
  user: User,
  payload: {
    domain: string;
    label: string;
    category: 'NASA' | 'PDS' | 'ESA' | 'USGS' | 'NOAA' | 'Oficial';
    active: boolean;
  }
): Promise<void> {
  const id = sanitizeDocId(`${user.uid.slice(0, 12)}_${payload.domain}`);
  const path = `whitelistDomains/${id}`;
  try {
    await setDoc(doc(db, 'whitelistDomains', id), {
      id,
      domain: payload.domain.slice(0, 160),
      label: (payload.label || payload.domain).slice(0, 120),
      category: payload.category,
      active: Boolean(payload.active),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function toggleDominioFirestore(
  docId: string,
  active: boolean
): Promise<void> {
  const path = `whitelistDomains/${docId}`;
  try {
    await updateDoc(doc(db, 'whitelistDomains', docId), {
      active: Boolean(active),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function eliminarDominioFirestore(docId: string): Promise<void> {
  const path = `whitelistDomains/${docId}`;
  try {
    await deleteDoc(doc(db, 'whitelistDomains', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function guardarEntradaFirestore(
  user: User,
  entry: Omit<
    FirestoreKnowledgeEntry,
    'id' | 'ownerUid' | 'createdAt' | 'updatedAt'
  >
): Promise<void> {
  const id = sanitizeDocId(`entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const path = `knowledgeEntries/${id}`;
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;

  try {
    await setDoc(doc(db, 'knowledgeEntries', id), {
      id,
      ownerUid: user.uid,
      tipo: entry.tipo,
      sitio: (entry.sitio || 'Sitio desconocido').slice(0, 140),
      sourceUrl: (entry.sourceUrl || 'https://nasa.gov').slice(0, 500),
      sourceDomain: (entry.sourceDomain || 'nasa.gov').slice(0, 160),
      whitelisted: Boolean(entry.whitelisted),
      autoApproved: Boolean(entry.autoApproved),
      verifiedBySearch: Boolean(entry.verifiedBySearch),
      verificationSummary: (entry.verificationSummary || '').slice(0, 1200),
      status: entry.status,
      temperatura: clamp(entry.temperatura, 0, 1000),
      presion: clamp(entry.presion, 0, 1e7),
      viento: clamp(entry.viento, 0, 150),
      luz: clamp(entry.luz, 0, 1500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function suscribirDatosUsuario(
  user: User,
  callbacks: {
    onWhitelist: (items: FirestoreWhitelistItem[]) => void;
    onEntries: (entries: FirestoreKnowledgeEntry[]) => void;
    onError?: (msg: string) => void;
  }
): () => void {
  const qWhite = query(
    collection(db, 'whitelistDomains'),
    where('ownerUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  const qEntries = query(
    collection(db, 'knowledgeEntries'),
    where('ownerUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  const unsubWhite = onSnapshot(
    qWhite,
    (snap) => {
      callbacks.onWhitelist(
        snap.docs.map((d) => d.data() as FirestoreWhitelistItem)
      );
    },
    (err) => callbacks.onError?.(err.message)
  );

  const unsubEntries = onSnapshot(
    qEntries,
    (snap) => {
      callbacks.onEntries(
        snap.docs.map((d) => d.data() as FirestoreKnowledgeEntry)
      );
    },
    (err) => callbacks.onError?.(err.message)
  );

  return () => {
    unsubWhite();
    unsubEntries();
  };
}
