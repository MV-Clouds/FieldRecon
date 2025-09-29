/*
    This class is without sharing so that the batch class runs
    withut taking into user's permissions.
*/
public without sharing class FeatureJob implements Schedulable {
    public void execute(SchedulableContext SC) {
        BatchFeatureUpdate bfu = new BatchFeatureUpdate();
        Database.executebatch(bfu);
     }
}