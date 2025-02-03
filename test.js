import SystemConfig from './systemConfig.js';

const config = new SystemConfig();

console.log("Mongo URI:", config.getMongoUri());
console.log("Mongo Database Name:", config.getMongoDbName());
