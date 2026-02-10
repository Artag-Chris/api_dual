import 'dotenv/config';
import { get } from 'env-var';
 

export const envs = {  

  PORT: get('PORT').required().asPortNumber(),

  DATABASE_URL_LEGACY: get('DATABASE_URL_LEGACY').required().asString(),

  DATABASE_URL_MAIN: get('DATABASE_URL_MAIN').required().asString(),

}




