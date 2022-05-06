import { Injectable } from "@angular/core";
import { Token } from "@functions/interfaces/models/token";
import { BehaviorSubject } from "rxjs";

@Injectable({
  providedIn: 'any'
})
export class DataService {
  public token$: BehaviorSubject<Token | undefined> = new BehaviorSubject<Token | undefined>(undefined);
}