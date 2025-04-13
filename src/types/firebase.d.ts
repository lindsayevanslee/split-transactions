declare module 'firebase/app' {
  interface FirebaseApp {
    name: string;
    options: Record<string, unknown>;
  }
}

declare module 'firebase/auth' {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
  }

  interface AuthError {
    code: string;
    message: string;
  }

  export function getAuth(app?: FirebaseApp): Auth;
  export function signInWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  export function createUserWithEmailAndPassword(auth: Auth, email: string, password: string): Promise<{ user: User }>;
  export function signOut(auth: Auth): Promise<void>;
  export function onAuthStateChanged(auth: Auth, callback: (user: User | null) => void): () => void;
}

declare module 'firebase/firestore' {
  interface Firestore {
    app: FirebaseApp;
    type: string;
    toJSON(): object;
  }

  interface DocumentData {
    [field: string]: unknown;
  }

  interface QueryDocumentSnapshot<T = DocumentData> {
    id: string;
    data(): T;
  }

  interface QuerySnapshot<T = DocumentData> {
    docs: QueryDocumentSnapshot<T>[];
  }

  interface DocumentSnapshot<T = DocumentData> {
    id: string;
    data(): T | undefined;
  }

  interface Timestamp {
    toDate(): Date;
  }

  interface FirestoreError {
    code: string;
    message: string;
  }

  export function getFirestore(app?: FirebaseApp): Firestore;
  export function collection(firestore: Firestore, path: string): CollectionReference;
  export function doc(firestore: Firestore, path: string, ...pathSegments: string[]): DocumentReference;
  export function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot>;
  export function getDocs(query: Query): Promise<QuerySnapshot>;
  export function setDoc(docRef: DocumentReference, data: DocumentData): Promise<void>;
  export function updateDoc(docRef: DocumentReference, data: DocumentData): Promise<void>;
  export function deleteDoc(docRef: DocumentReference): Promise<void>;
  export function addDoc(collectionRef: CollectionReference, data: DocumentData): Promise<DocumentReference>;
  export function query(collectionRef: CollectionReference, ...queryConstraints: QueryConstraint[]): Query;
  export function where(field: string, opStr: string, value: unknown): QueryConstraint;
  export function orderBy(field: string, directionStr?: 'asc' | 'desc'): QueryConstraint;
} 