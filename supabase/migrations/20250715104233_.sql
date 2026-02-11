-- Fix Xero API endpoint paths - correct typo from /api.xro/2.0/ to /api.xero.com/2.0/
UPDATE api_endpoints 
SET path = REPLACE(path, '/api.xro/2.0/', '/api.xero.com/2.0/')
WHERE path LIKE '%/api.xro/2.0/%';;
