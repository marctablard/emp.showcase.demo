import type { BindingScope } from 'inversify';
import { injectable as inversifyInjectable } from 'inversify';
import 'reflect-metadata';

export const ID_KEY = 'emp_inversify:id';

/**
 * Extended injectable decorator that allows specifying an ID
 * @param id Optional identifier for the injectable class
 * @param scope Optional binding scope for the injectable
 * @returns Class decorator
 */
export function injectable(id?: string | symbol, scope?: BindingScope) {
  return function (target: any) {
    // Store the ID in metadata if provided
    if (id !== undefined) {
      Reflect.defineMetadata(ID_KEY, id, target);
    }

    // Apply the original inversify injectable decorator
    return inversifyInjectable(scope)(target);
  };
}

/**
 * Get the ID of an injectable class
 * @param target The class to get the ID for
 * @returns The ID of the class or the class itself if no ID was specified
 */
export function getInjectableId(target: any): any {
  return Reflect.hasMetadata(ID_KEY, target) ? Reflect.getMetadata(ID_KEY, target) : target;
}
