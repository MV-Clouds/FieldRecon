import { LightningElement,api } from 'lwc';
import setDefaults  from '@salesforce/apex/DefaultsController.setDefaults';
import fetchJobsData  from '@salesforce/apex/DefaultsController.fetchJobsData';
import getClockInDefault from '@salesforce/apex/DefaultsController.getClockInDefault';
import updateClockInDefault from '@salesforce/apex/DefaultsController.updateClockInDefault';
import getLocationDefault from '@salesforce/apex/DefaultsController.getLocationDefault';
import updateLocationDefault from '@salesforce/apex/DefaultsController.updateLocationDefault';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class JobDefault extends LightningElement {
    startTime = "08:00:00.000Z";
    endTime = "17:00:00.000Z";
    //maxDistance = 2;
    satData = false;
    sunData = false;
    isLoading = false;
    locationValue = false;
    jobId = '';
    clockInDefault = false;
    @api formFactor;
    connectedCallback() {
        this.getInitialData();
    }

    getInitialData(){
        this.isLoading = true;
        fetchJobsData()
        .then(res => {
            console.log(res);
            if(res.length != 0) {
                //this.maxDistance = res.maxDistance;
                this.satData = res.saturdayData != undefined ? res.saturdayData : false;
                this.sunData = res.sundayData != undefined ? res.sundayData : false;
                var startTime = res.startTime;
                //startTime = startTime.substr(1);
                //startTime = startTime.slice(0,-1);
                var endTime = res.endTime;
                //endTime = endTime.substr(1);
                //endTime = endTime.slice(0,-1);
                console.log(startTime);
                this.startTime = startTime;
                this.endTime = endTime;
                this.jobId = res.jobId;
            }
            //this.isLoading = false;
        })
        .catch(err => {
            console.error(err);
            //this.isLoading = false;
        })

        getClockInDefault()
            .then(result => {
                //this.isLoading = false;
                this.clockInDefault = result;
            })
            .catch(error => {
                //this.isLoading = false;
                console.error(error);
            });

        getLocationDefault()
        .then(result => {
            this.isLoading = false;
            this.locationValue = result;
        })
        .catch(error => {
            this.isLoading = false;
            console.error(error);
        });
    }
    handleChangeForFields(event) {
        var fieldChanged = event.target.name;
        switch(fieldChanged) {
            case "startTime" : 
                this.startTime = event.target.value;
                break;
            case "endTime" :
                this.endTime = event.target.value;
                break;
            //case "maxDis" :
                //this.maxDistance = event.target.value;
                //break;
            case "satData" :
                this.satData = event.target.checked;
                break;
            case "sunData" :
                this.sunData = event.target.checked;
                break;
            case "clockIn" :
                this.clockInDefault = event.target.checked;
                break;
            case "location" :
                this.locationValue = event.target.checked;
                break;
            
        }
        console.log(this.startTime);
    }
    saveJobDefaults() {
        this.isLoading = true;
        //this.convertTime(this.endTime);
        var defaults = {};
        defaults['startTime'] = this.startTime.length == 8 ? this.startTime : this.convertTime(this.startTime.slice(0,-5));
        defaults['endTime'] = this.endTime.length == 8 ?  this.endTime : this.convertTime(this.endTime.slice(0,-5));
        //defaults['maxDistance'] = this.maxDistance;
        defaults['saturdayData'] = this.satData;
        defaults['sundayData'] = this.sunData;
        defaults['jobId'] = this.jobId;
        var defaultsToString = JSON.stringify(defaults);
        console.log(defaultsToString);
        setDefaults({
            defaults : defaultsToString })
        .then(res => {
            console.log(res);
            //this.isLoading = false;
            this.createToastMessage("Updated Successfully!","Default data for jobs has been updated","success");
        })
        .catch(err => {
            console.error(err);
            //this.isLoading = false;
            this.createToastMessage("An error occurred",JSON.stringify(err),"error");
        })

        updateClockInDefault({updatedValue : this.clockInDefault})
            .then(result => {
                //this.isLoading = false;
            })
            .catch(error => {
                //this.isLoading = false;
                console.error(error);
                this.createToastMessage("An error occurred",JSON.stringify(error),"error");
            });

            updateLocationDefault({updatedValue : this.locationValue})
            .then(result => {
                this.isLoading = false;
            })
            .catch(error => {
                this.isLoading = false;
                console.error(error);
                this.createToastMessage("An error occurred",JSON.stringify(error),"error");
            });


    }
    convertTime(oldTime) {
        let initString = parseInt(oldTime[0] + oldTime[1]);
        let finalTimeString;
        let timeString = '';
        let hours;
        console.log(initString);
        if(initString >= 12) {
            timeString = 'PM';
        }
        else{
            timeString = 'AM';
        }
        if(initString == 0) {
            hours = '12';
        }
        else {
            if(timeString == 'PM' && initString % 12 == 0) {
                hours = '12';
            }
            else{
                hours = ((initString % 12 < 10) ? '0'+ String(initString % 12) : '' + (initString % 12) );
            }
        }
        hours += ':';
        finalTimeString =  hours + oldTime.substring(3,5) + ' ' + timeString ;
        console.log(hours);
        console.log(finalTimeString);
        console.log(finalTimeString.length);
        return finalTimeString;
    }
    cancelChanges(){
        this.getInitialData();
    }
    createToastMessage(title,msg,type) {
        const event = new ShowToastEvent({
            title: title,
            message: msg,
            variant: type,
        });
        this.dispatchEvent(event);
    }
}