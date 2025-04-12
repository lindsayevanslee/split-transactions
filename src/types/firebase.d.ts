declare module 'firebase/app' {
  export interface FirebaseApp {
    // Add any specific Firebase app properties you need
  }
  export function initializeApp(config: object): FirebaseApp;
}

declare module 'firebase/auth' {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
  }

  export interface AuthError {
    code: string;
    message: string;
  }

  export function getAuth(app?: FirebaseApp): any;
  export function signInWithEmailAndPassword(auth: any, email: string, password: string): Promise<{ user: User }>;
  export function createUserWithEmailAndPassword(auth: any, email: string, password: string): Promise<{ user: User }>;
  export function signOut(auth: any): Promise<void>;
  export function onAuthStateChanged(auth: any, callback: (user: User | null) => void): () => void;
}

declare module 'firebase/firestore' {
  export interface Firestore {
    // Add any specific Firestore properties you need
  }

  export interface DocumentData {
    [field: string]: any;
  }

  export interface Timestamp {
    toDate(): Date;
  }

  export function getFirestore(app?: FirebaseApp): Firestore;
  export function collection(firestore: Firestore, path: string): any;
  export function doc(firestore: Firestore, path: string, ...pathSegments: string[]): any;
  export function getDoc(docRef: any): Promise<{ data(): DocumentData | undefined }>;
  export function getDocs(query: any): Promise<{ docs: Array<{ data(): DocumentData, id: string }> }>;
  export function setDoc(docRef: any, data: DocumentData): Promise<void>;
  export function updateDoc(docRef: any, data: DocumentData): Promise<void>;
  export function deleteDoc(docRef: any): Promise<void>;
  export function addDoc(collectionRef: any, data: DocumentData): Promise<{ id: string }>;
  export function query(collectionRef: any, ...queryConstraints: any[]): any;
  export function where(field: string, opStr: string, value: any): any;
  export function orderBy(field: string, directionStr?: 'asc' | 'desc'): any;
} 