import { Knex } from 'knex';
import { flattenObject } from '../src/common';
import * as triggers from '../src/runtime/trigger/index';
import { TriggeredFunction, TriggeredFunctionType } from '../src/runtime/trigger/trigger';

export const createChangeTriggers = async (knex: Knex) => {
  const promises = Object.entries(flattenObject(triggers)).map(async ([key, v]) => {
    const trigger = v as TriggeredFunction;
    const table = trigger.col + (trigger.subCol ? '_' + trigger.subCol : '');
    const opr = (type: TriggeredFunctionType) => {
      switch (type) {
        case TriggeredFunctionType.ON_CREATE:
          return 'INSERT';
        case TriggeredFunctionType.ON_UPDATE:
          return 'UPDATE';
        case TriggeredFunctionType.ON_WRITE:
          return 'INSERT OR UPDATE ';
        default:
          throw Error('Invalid type: ' + type);
      }
    };

    await knex.raw(`     
       CREATE OR REPLACE FUNCTION ${key}_func() RETURNS TRIGGER AS $$ 
        DECLARE        
          payload JSON;        
          subCol TEXT;        
          subColId TEXT;        
          generated_id INT;     
        BEGIN         
          subCol := '${trigger.subCol || null}';        
          subColId := ${trigger.subCol ? 'NEW."parentId"' : null};
  
          payload := json_build_object(          
            'col', '${trigger.col}',          
            'uid', NEW.uid,          
            'subCol', subCol,          
            'subColId', subColId,          
            'prev', row_to_json(OLD),          
            'curr', row_to_json(NEW)
          );                
          
          INSERT INTO changes(change)         
          VALUES (payload)        
          RETURNING uid INTO generated_id;   
          
          PERFORM pg_notify('trigger', '${key}' || ':' || generated_id::text);        
          RETURN NEW;      
        END;      
        $$ LANGUAGE plpgsql;      
        CREATE OR REPLACE TRIGGER ${key} AFTER ${opr(trigger.type)} ON ${table}      
        FOR EACH ROW EXECUTE FUNCTION ${key}_func();   
    `);
  });

  await Promise.all(promises);
};
