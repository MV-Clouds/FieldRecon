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
/**
 * @created 2021-02-22
 * @author concret.io

*/ 
public with sharing class Lib_Error {
    
    public static Exception create(Cause cause, String message) {
        return create(new Context(cause, message), null);
    }

    public static Exception create(Context ctx, Exception ex) {               
        String ctxStr = JSON.serializePretty(ctx);
        // VF Page or Async Apex
        if(Apexpages.currentPage() != null  || isAsync()) {
            return ex != null ? new AppException(ctxStr, ex) : new AppException(ctxStr);
        }
        System.debug(ctxStr);
        return new System.AuraHandledException(ctxStr);
    }
    

    public static Boolean isAsync(){
        return  System.isBatch() || System.isScheduled() 
                            || System.isQueueable() || System.isFuture();
    }

    // App Exception
    public virtual class AppException extends Exception {}

    public enum Cause {
        Security, Validation, Unknown, Callout, Config, Auth
    }
    
    public class Context {
        public String cause {get;set;}
        public String message {get;set;}        
        public Set<String> customPermissions = new Set<String>();        
        
        public Context(Cause cause, String message) {            
            this.cause = cause.name();           
            this.message = message;
        }        
        
    }
}