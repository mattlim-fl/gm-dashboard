-- Fix Xero API endpoint paths - remove duplicate domain from paths
UPDATE api_endpoints 
SET path = REPLACE(path, '/api.xero.com/2.0/', '/2.0/')
WHERE path LIKE '%/api.xero.com/2.0/%';;
