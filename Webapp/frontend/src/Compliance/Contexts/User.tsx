import {User} from "firebase/auth";

export declare interface U extends User {
    isAdmin: boolean;
    user: User | null;
}