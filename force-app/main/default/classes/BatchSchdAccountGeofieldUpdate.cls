global class BatchSchdAccountGeofieldUpdate implements Schedulable{
    public static Integer btchSize{
        get{
            if(btchSize != NULL) { return btchSize;}
            List<wfrecon__BatchSize__c> getSize = wfrecon__BatchSize__c.getAll().values();
            if(getSize.isEmpty()){
                getSize.add(new wfrecon__BatchSize__c(Name = 'Batch Size' ,wfrecon__Size__c = 20));
                INSERT getSize;
            }
            btchSize = Integer.valueOf(getSize[0].wfrecon__Size__c);
            return btchSize;
        }set;
    }
    global void execute(SchedulableContext sc){
        database.executebatch(new BatchAccountGeofieldUpdate(),btchSize);
    }
}