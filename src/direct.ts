import { run } from '.';
import { config } from 'dotenv';
import { SetLogLevel } from 'ag-common/dist/common/helpers/log';
config();
SetLogLevel(process.env.LOG_LEVEL as any);
void run();
