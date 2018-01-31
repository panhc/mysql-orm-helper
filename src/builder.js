const _utils = require('./utils.js');


class Builder {

    constructor(tableName){
        this._whereStatus = 'and';
        this._query = {
            table: tableName,
            operate: 'select',
            fields: ['*'],
            insertOrUpdateObj: {},
            join: {
                mode: '',
                tName: ''
            },
            on: '',
            wheres: {
                and: [],
                or: []
            },
            orders: {},
            skip: 0,
            take: null
        };
        this.result = null;
    }

    select(params){
        this._query.operate = 'select';
        if(typeof params === 'string'){
            this._query.fields = [...this._query.fields,params];
        }
        if(Array.isArray(params)){
            this._query.fields = [...this._query.fields,...params];
        }

        return this;
    }

    where(...params){
        //长度为1，并且为json  {'name':'bob','age':10}
        //长度大于1，为2加等号，为三不加
        switch (params.length){
            case 1:
                let _q = params[0];

                if(_utils.isFunction(_q)){
                    _q.call(null,this);
                }else if(_utils.isJson(_q)){
                    let _wheres = [];
                    for(let key in _q){
                        _wheres.push(`${key} = ${_q[key]}`);
                    }
                    this._query.wheres[this._whereStatus] = [...this._query.wheres[this._whereStatus],..._wheres];
                }
                break;
            case 2:
                this._query.wheres[this._whereStatus] = [...this._query.wheres[this._whereStatus],`${params[0]} = ${params[1]}`];
                break;
            case 3:
                this._query.wheres[this._whereStatus] = [...this._query.wheres[this._whereStatus],params.join(' ')];
                break;
        }

        return this;
    }

    orWhere(...params){
        this._whereStatus = 'or';
        this.where.apply(this,params);
        this._whereStatus = 'and';

        return this;
    };

    whereBetween(filed,value1,value2){
        this._query.wheres.and.push(`${filed} between ${value1} and ${value2}`);
        return this;
    }

    whereIn(field,arr){
        this._query.wheres.and.push(`${field} in ( ${arr.join(',')} )`);
        return this;
    }

    orderBy(field,mode = 'asc'){
        if(_utils.isString(field)){
            this._query.orders[field] = mode;
        }
        if(_utils.isJson(field)){
            this._query.orders = Object.assign({},this._query.orders,field);
        }
        if(_utils.isArray(field)){
            let _query = {};
            field.forEach(item=>{
                _query[item] = mode;
            })
            this._query.orders = Object.assign({},this._query.orders,_query);
        }

        return this;
    }

    skip(num){
        this._query.skip = num;
        return this;
    }

    take(num){
        this._query.take = num;
        return this;
    }

    offset(num){
        return this.skip.call(this,num)
    }

    limit(num){
        return this.take.call(this,num)
    }

    all(){
        this._query.operate = 'select';
        this._query.fields = ['*'];
        return this.toSql();
    }

    get(params = []){
        params.length && (this._query.fields = params);

        return this.toSql();
    }

    find(id){
        if(typeof id !== 'string' || typeof id !== 'number'){
            throw Error('id should be table key');
        }

        this._query.wheres.and = [...this._query.wheres.and,`id = ${id}`];

        return this.toSql();
    }

    create(obj){
        //接受一个对象类型
        this._query.operate = 'insert';
        this._query.insertOrUpdateObj = obj;
        return this.toSql();
    }

    update(obj){
        //接受一个对象类型
        this._query.operate = 'update';
        this._query.insertOrUpdateObj = obj;
        return this.toSql();
    }

    delete(){
        this._query.operate = 'delete';
        return this.toSql();
    }

    join(tName,mode = ''){
        this._query.join.mode = mode;
        this._query.join.tName = tName;
        return this;
    }

    leftJoin(tName){
        this.join.call(this,tName,'left');
        return this;
    }

    rightJoin(tName){
        this.join.call(this,tName,'right');
        return this;
    }

    innerJoin(tName){
        this.join.call(this,tName,'inner');
        return this;
    }

    fullJoin(tName){
        this.join.call(this,tName,'full');
        return this;
    }

    on(...params){
        switch (params.length){
            case 1:
                this._query.on = params[0];
                break;
            case 2:
                this._query.on = `${params[0]} = ${params[1]}`;
                break;
            case 3:
                this._query.on = params.join(' ');
                break;
            default:
                throw Error('unknow params');
        }

        return this;
    }

    toSql(){
        let q = [];

        switch (this._query.operate){
            case 'select':
                q.push('select',[...new Set(this._query.fields)].join(','),'from',this._query.table);
                break;
            case 'delete':
                q.push(`delete from ${this._query.table}`);
                break;
            case 'update':
                let opArr = [];
                for(let key in this._query.insertOrUpdateObj){
                    opArr.push(`${key}=${this._query.insertOrUpdateObj[key]}`);
                }
                q.push(`update ${this._query.table} set ${opArr.join(',')}`);
                break;
            case 'insert':
                this.result = `insert into ${this._query.table} set (${Object.keys(this._query.insertOrUpdateObj).join(',')}) values (${Object.values(this._query.insertOrUpdateObj).join(',')});`;
                return this;
        }
        //处理join语句块
        if(this._query.join.tName && this._query.on){
            q.push(`${this._query.join.mode} join ${this._query.join.tName} on ${this._query.on}`);
        }

        //处理where语句块
        (this._query.wheres.and.length || this._query.wheres.or.length) && q.push('where');
        this._query.wheres.and.length && q.push(`${this._query.wheres.and.join(' and ')}`);

        if(this._query.wheres.or.length){
            if(this._query.wheres.and.length){
                q.push('or (');
                q.push(`${this._query.wheres.or.join(' and ')}`);
                q.push(')');
            }else {
                q.push(`${this._query.wheres.or.join(' and ')}`)
            }
        }

        //处理 order
        if(!_utils.isEmpty(this._query.orders)){
            q.push('order by');
            let _orderArr = [];
            for(let key in this._query.orders){
                _orderArr.push(`${key} ${this._query.orders[key]}`);
            }
            q.push(_orderArr.join(','));
        }

        //处理分页
        if(this._query.take){
           q.push(`limit ${this._query.skip},${this._query.take}`);
        }

        q.push(';');
        this.result = q.join(' ');
        return this;
    }
    
}

if(require.main === module){
    let l = new Builder('actions').leftJoin('flows').on('flows.id','actions.flow_id').get();

    console.log(l);
}






