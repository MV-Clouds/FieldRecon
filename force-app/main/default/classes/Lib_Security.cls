/*
Copyright (c) www.concret.io
All rights reserved.
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. The name of the author may not be used to endorse or promote products
   derived from this software without specific prior written permission.
THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, 
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

public inherited sharing class Lib_Security {
    /**
     * Enforces sharing rules, and gives across all DB operations. This should be the most widely used Database for 
     * any purposes, unless an exposure to more data is needed
     */
    public static SecureDatabase ws(){
        return new WS_Database();
    }
    /**
     * Works in INHERITED SHARING mode for all DB operations. This is meant to be used for cases
     * where access to all data is needed for transactions. 
     */
    public static SecureDatabase is(){
        return new IS_Database();
    }
    /**
     * Contract for Database operations. This layer is meant to enfore security transparently, 
     * which avoids need of a similar CRUD/FLS check code before/after every SOQL, or DML. 
     * Thus, this makes the developer free to focus more on business logic, instead of 
     * Database security. 
     *
     * Note: One can add more overloaded forms of methods to the contract as needed, 
     * as of now the bare minimum contract required by the App is added here. 
     */
    public interface SecureDatabase {
        /**
            Allows queries to easily run with multiple args, typically a SOQL syntax doesn't permits args
            For ex. 
            String subject = '%Email%';
            Task[] tasks = [Select Id, Subject from Task Where Id IN: taskIds or Subject like :email];

            Above SOQL needs to be changed as follows
            String subject = '%Email%';
            String soql = 'Select Id, Subject from Task Where Id IN: arg1 or Subject like :arg2';
            Task[] tasks = [Your WITH/WITHOUT sharing impl].dbQuery(soql, new Object[]{taskIds, subject});

            Please note that arg1 and arg2 are index based place holder for soql arguments.

            Currently this method supports upto 9 arguments.         
         */
        AggregateResult[] dbAggreQuery(String query, Object[] args);
        SObject[] dbQuery(String query, Object[] args);
        Integer dbCountQuery(String value, String query, Object[] args);
        /**
         * All of the DML operations below assume ALLORNONE = TRUE mode, i.e. the whole transaction with all records
         * will crash in case of any error. If partial success transactions are needed, please expose more contract m
         * methods.
         */
        Database.SaveResult[]   dbInsert(SObject[] records);
        Database.SaveResult[]   dbInsert(SObject[] records,Boolean recordsOperation);
        Database.SaveResult[]   dbUpdate(SObject[] records);
        Database.UpsertResult[] dbUpsert(SObject[] records);
        Database.DeleteResult[] dbDelete(SObject[] records);
        Database.DeleteResult[] dbDelete(SObject[] records,Boolean recordsOperation);
    }

    /**
     * WITH SHARING database implementation
     */
    public with sharing class WS_Database implements SecureDatabase {
        //encapsulating inherited sharing SecureDatabase implementation to make it 
        // easy to reuse code and logic for all the contract
        IS_Database isDB = new IS_Database();
        public Integer dbCountQuery(String value, String query, Object[] args){
            return isDB.dbCountQuery(value,query,args);
        }
        public AggregateResult[] dbAggreQuery(String query, Object[] args){
            return isDB.dbAggreQuery(query, args);
        }
        public SObject[] dbQuery(String query, Object[] args){
            return isDB.dbQuery(query, args);
        }

        public Database.SaveResult[] dbInsert(SObject[] records){
            return isDB.dbInsert(records);
        }

        public Database.SaveResult[] dbInsert(SObject[] records,Boolean recordsOperation){
            return isDB.dbInsert(records);
        }

        public Database.SaveResult[] dbUpdate(SObject[] records){
            return isDB.dbUpdate(records);
        }
        
        public Database.UpsertResult[] dbUpsert(SObject[] records) {
            return isDB.dbUpsert(records);
        }

        public Database.DeleteResult[] dbDelete(SObject[] records){
            return isDB.dbDelete(records);
        }

        public Database.DeleteResult[] dbDelete(SObject[] records,Boolean recordsOperation){
            return isDB.dbDelete(records);
        }

    }
    /**
     * SecureDatabase Implementation in inherited mode, makes it flexible to adapt to any
     * required sharing mode
     */
    public inherited sharing class IS_Database implements SecureDatabase {
        Boolean allOrNone = true;
        public Integer dbCountQuery(String value,String query, Object[] args) {
            Integer count;
            args = args == null ? new Object[]{} : args;        
            Object arg1 = args.size() >=  1 ? args[0] : null;            
            Object arg2 = args.size() >=  2 ? args[1] : null;
            Object arg3 = args.size() >=  3 ? args[2] : null;
            Object arg4 = args.size() >=  4 ? args[3] : null;
            Object arg5 = args.size() >=  5 ? args[4] : null; 
            Object arg6 = args.size() >=  6 ? args[5] : null; 
            Object arg7 = args.size() >=  7 ? args[6] : null;
            Object arg8 = args.size() >=  8 ? args[7] : null; 
            Object arg9 = args.size() >=  9 ? args[8] : null;      
            try {
                count = Database.countQuery(value+query);
            } catch (QueryException qe){
                /*
                    Parsing QueryException for following message prefix, and 
                    throwing Lib_Error's exception, that generates right type of 
                    AuraHandledException or usual Exception based on Async va Aura context
                    System.QueryException: Insufficient permissions: secure query included inaccessible field
                */
                if (qe.getMessage().containsIgnoreCase('Insufficient permissions')){                    
                    throw Lib_Error.create(Lib_Error.Cause.Security, qe.getMessage());

                } else {
                    throw qe;
                }
            }
            return count;
        }
        
        //query for aggregate result starts from here
        /**
         * Currently this method supports 1 arguments. Based on the simple logic below
         * feel free to add any number of args required, for most cases 1 args handle quite complex queries.
         */
        public AggregateResult[] dbAggreQuery(String query, Object[] args) {
            AggregateResult[] records = null;
            args = args == null ? new Object[]{} : args;        
            Object arg1 = args.size() >=  1 ? args[0] : null;                 
            try {
                records = Database.query(query);
            } catch (QueryException qe){
                /*
                    Parsing QueryException for following message prefix, and 
                    throwing Lib_Error's exception, that generates right type of 
                    AuraHandledException or usual Exception based on Async va Aura context
                    System.QueryException: Insufficient permissions: secure query included inaccessible field
                */
                if (qe.getMessage().containsIgnoreCase('Insufficient permissions')){                    
                    throw Lib_Error.create(Lib_Error.Cause.Security, qe.getMessage());

                } else {
                    throw qe;
                }
            }
            /*
             * Still using Security.stripInaccessible(..) this will let any 
             * SOQL which missed adding "WITH SECURITY ENFORCED" go thru security check
             */
            // Check CRUD/FLS
            assertReadAggre(records);
            return records;
        }
        //aggregate result query ends here
        /**
         * Currently this method supports upto 11 arguments. Based on the simple logic below
         * feel free to add any number of args required, for most cases upto 11 args handle quite complex queries.
         */
        public SObject[] dbQuery(String query, Object[] args) {
            Sobject[] records = null;
            args = args == null ? new Object[]{} : args;        
            Object arg1 = args.size() >=  1 ? args[0] : null;            
            Object arg2 = args.size() >=  2 ? args[1] : null;
            Object arg3 = args.size() >=  3 ? args[2] : null;
            Object arg4 = args.size() >=  4 ? args[3] : null;
            Object arg5 = args.size() >=  5 ? args[4] : null; 
            Object arg6 = args.size() >=  6 ? args[5] : null; 
            Object arg7 = args.size() >=  7 ? args[6] : null;
            Object arg8 = args.size() >=  8 ? args[7] : null; 
            Object arg9 = args.size() >=  9 ? args[8] : null;
            Object arg10 = args.size() >=  10 ? args[9] : null; 
            Object arg11 = args.size() >=  11 ? args[10] : null;      
            try {
                records = Database.query(query);
            } catch (QueryException qe){
                /*
                    Parsing QueryException for following message prefix, and 
                    throwing Lib_Error's exception, that generates right type of 
                    AuraHandledException or usual Exception based on Async va Aura context
                    System.QueryException: Insufficient permissions: secure query included inaccessible field
                */
                if (qe.getMessage().containsIgnoreCase('Insufficient permissions')){                    
                    throw Lib_Error.create(Lib_Error.Cause.Security, qe.getMessage());

                } else {
                    throw qe;
                }
            }
            /*
             * Still using Security.stripInaccessible(..) this will let any 
             * SOQL which missed adding "WITH SECURITY ENFORCED" go thru security check
             */
            // Check CRUD/FLS
            assertRead(records);
            return records;
        }
        
        public Database.SaveResult[] dbInsert(SObject[] records){
            assertCreate(records);
            return Database.insert(records, allOrNone);
        }

        public Database.SaveResult[] dbInsert(SObject[] records,Boolean recordsOperation){
            assertCreate(records);
            return Database.insert(records, recordsOperation);
        }

        public Database.SaveResult[] dbUpdate(SObject[] records) {
            assertUpdate(records);
            return Database.update(records, allOrNone);
        }

        public Database.DeleteResult[] dbDelete(SObject[] records){
            assertDelete(records);
            return Database.delete(records, allOrNone);
        }

        public Database.DeleteResult[] dbDelete(SObject[] records,Boolean recordsOperation){
            assertDelete(records);
            return Database.delete(records, recordsOperation);
        }

        public Database.UpsertResult[] dbUpsert(SObject[] records){
            assertUpsert(records);
            return Database.upsert(records);
        }
    }

    /**
     * Checks READ access on Object, and Fields accessed on the given record
     * @param record to be checked for CRUD/FLS access.
     */
    public static void assertReadAggre(AggregateResult[] records) {
        assertAccessAggre(AccessType.READABLE, records);
    }

    /**
     * Checks READ access on Object, and Fields accessed on the given records
     * @param records to be checked for CRUD/FLS access.
     */
    public static void assertRead(SObject[] records) {
        assertAccess(AccessType.READABLE, records);
    }

    /**
     * Checks UPDATE access on Object, and Fields accessed on the given records
     * @param records to be checked for CRUD/FLS access.
     */
    public static void assertUpdate(SObject[] records) {
        assertAccess(AccessType.UPDATABLE, records);        
    }
    /**
     * Checks UPSERT access on Object, and Fields accessed on the given records
     * @param records to be checked for CRUD/FLS access.
     */
    public static void assertUpsert(SObject[] records) {
        assertAccess(AccessType.UPSERTABLE, records);
    }
    
    /**
     * Checks CREATE access on Object, and Fields accessed on the given records
     * @param records to be checked for CRUD/FLS access.
     */
    public static void assertCreate(SObject[] records) {
        assertAccess(AccessType.CREATABLE, records);        
    }

    /**
     * Checks DELETE access on Object
     * @param records to be checked for CRUD access.
     */
    public static void assertDelete(SObject[] records) {
        if(records.size() > 0){
            Schema.SObjectType sObj = records[0].getSObjectType();
            if(!sObj.getDescribe().isDeletable()){
                throw Lib_Error.create(Lib_Error.Cause.Security, 'Delete access missing on '+records[0]);
            }
        }
    }
    
    /**
     * Checks required access level on Object, and Fields accessed on the given records
     * @param accessType type of access to assert on the given records     
     * @param records to be checked for CRUD/FLS access.
     */
    static void assertAccess(AccessType accessType, SObject[] records){
        if (records == null || accessType == null || records.isEmpty()) {
            return;
        }
        Schema.DescribeSObjectResult dsr = records[0].getSObjectType().getDescribe();
        String objectName = dsr.getLabel();
        if (dsr.isCustomSetting()) {
            /*
                Security.stripInaccessible(...) doesnt works correctly with protected custom settings
            */
            
            Boolean hasAccess = false;
            switch on accessType {
                when READABLE {		
                    hasAccess = dsr.isAccessible();
                }	
                when CREATABLE {		
                    hasAccess = dsr.isCreateable();
                }	
                when UPDATABLE {		
                    hasAccess = dsr.isUpdateable();
                }	
                when UPSERTABLE {	
                    hasAccess = dsr.isUpdateable() && dsr.isCreateable();
                }	
                when else {		  
                    hasAccess = false;
                }
            }
            if (hasAccess == false) {
                String msg = String.format('"{0}" access missing on Object: "{1}"', 
                                                new String[]{
                                                             accessType.name(), objectName
                                                            });
                // Object access missing
                throw Lib_Error.create(Lib_Error.Cause.Security, msg);
            }

        } else {
            // Normal Object
            try {
                // Strip fields that are not updatable
                SObjectAccessDecision decision = Security.stripInaccessible(accessType, records);
                //K: SObject Name, V: Set of Field Names which are not accessible. 
                Map<String,Set<String>> removedFields = decision.getRemovedFields();
                
    
                for(String objName : removedFields.keySet()){
                    //Name of missing access fields as CSV;
                    String fieldsCSV = Lib_Collections.toCSV(removedFields.get(objName));
                    String msg =  String.format('"{0}" access missing on Fields:"{1}" from Object: "{2}"', 
                                            new String[]{
                                                    accessType.name(), fieldsCSV, objectName
                                                });
                    throw Lib_Error.create(Lib_Error.Cause.Security, msg);
                }            
                
            } catch (System.NoAccessException ex) {
                String msg = String.format('"{0}" access missing on Object: "{1}"', 
                                            new String[]{
                                                         accessType.name(), objectName
                                                        });
                // Object access missing
                throw Lib_Error.create(Lib_Error.Cause.Security, msg);
            }
        }
    }
    ///////////////////////////////////////
    /**
     * Checks required access level on Object, and Fields accessed on the given records
     * @param accessType type of access to assert on the given records     
     * @param records to be checked for CRUD/FLS access.
     */
    static void assertAccessAggre(AccessType accessType, AggregateResult[] records){
        if (records == null || accessType == null || records.isEmpty()) {
            return;
        }
        Schema.DescribeSObjectResult dsr = records[0].getSObjectType().getDescribe();
        String objectName = dsr.getLabel();
        Boolean hasAccess = false;
        switch on accessType {
            when READABLE {		
                hasAccess = dsr.isAccessible();
            }	
            when CREATABLE {		
                hasAccess = dsr.isCreateable();
            }	
            when UPDATABLE {		
                hasAccess = dsr.isUpdateable();
            }	
            when UPSERTABLE {	
                hasAccess = dsr.isUpdateable() && dsr.isCreateable();
            }	
            when else {		  
                hasAccess = false;
            }
        }
        if (hasAccess == false) {
            String msg = String.format('"{0}" access missing on Object: "{1}"', 
                                            new String[]{
                                                            accessType.name(), objectName
                                                        });
            // Object access missing
            throw Lib_Error.create(Lib_Error.Cause.Security, msg);
        }
    }
}