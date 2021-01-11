<a name="JoshProvider"></a>

## JoshProvider
**Kind**: global class  

* [JoshProvider](#JoshProvider)
    * [new JoshProvider([options])](#new-joshprovider-options)
    * [.init(Josh)](#joshprovider-init-josh-promise) ⇒ <code>Promise</code>
    * [.get(key, path)](#joshprovider-get-key-path-promise-less-than-greater-than) ⇒ <code>Promise.&lt;\*&gt;</code>
    * [.getAll()](#joshprovider-getall-promise-less-than-object-less-than-greater-than-greater-than) ⇒ <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code>
    * [.getMany(keys)](#joshprovider-getmany-keys-promise-less-than-object-less-than-greater-than-greater-than) ⇒ <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code>
    * [.random(count)](#joshprovider-random-count-promise-less-than-object-less-than-greater-than-greater-than) ⇒ <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code>
    * [.randomKey(count)](#joshprovider-randomkey-count-promise-less-than-array-less-than-string-greater-than-greater-than) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.has(key, path)](#joshprovider-has-key-path-promise-less-than-boolean-greater-than) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.keys()](#joshprovider-keys-promise-less-than-array-less-than-string-greater-than-greater-than) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.values()](#joshprovider-values-promise-less-than-array-less-than-greater-than-greater-than) ⇒ <code>Promise.&lt;array.&lt;\*&gt;&gt;</code>
    * [.count()](#joshprovider-count-promise-less-than-integer-greater-than) ⇒ <code>Promise.&lt;integer&gt;</code>
    * [.set(key, path, val)](#joshprovider-set-key-path-val-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.setMany(data, overwrite)](#joshprovider-setmany-data-overwrite-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.delete(key, path)](#joshprovider-delete-key-path-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.clear()](#joshprovider-clear-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.push(key, path, value, allowDupes)](#joshprovider-push-key-path-value-allowdupes-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.remove(key, path, val)](#joshprovider-remove-key-path-val-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.inc(key, path)](#joshprovider-inc-key-path-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.dec(key, path)](#joshprovider-dec-key-path-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.math(key, path, operation, operand)](#joshprovider-math-key-path-operation-operand-promise-less-than-provider-greater-than) ⇒ <code>Promise.&lt;Provider&gt;</code>
    * [.findByFunction(fn, path)](#joshprovider-findbyfunction-fn-path-promise-less-than-greater-than) ⇒ <code>Promise.&lt;\*&gt;</code>
    * [.findByValue(path, value)](#joshprovider-findbyvalue-path-value-promise-less-than-greater-than) ⇒ <code>Promise.&lt;\*&gt;</code>
    * [.filterByFunction(fn, path)](#joshprovider-filterbyfunction-fn-path-promise-less-than-object-greater-than) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.filterByValue(path, value)](#joshprovider-filterbyvalue-path-value-promise-less-than-object-greater-than) ⇒ <code>Promise.&lt;Object&gt;</code>
    * [.mapByValue(path)](#joshprovider-mapbyvalue-path-promise-less-than-array-less-than-string-greater-than-greater-than) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * [.mapByFunction(fn)](#joshprovider-mapbyfunction-fn-promise-less-than-array-less-than-greater-than-greater-than) ⇒ <code>Promise.&lt;Array.&lt;\*&gt;&gt;</code>
    * [.includes(key, path, val)](#joshprovider-includes-key-path-val-promise-less-than-boolean-greater-than) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.someByPath(path, value)](#joshprovider-somebypath-path-value-promise-less-than-boolean-greater-than) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.someByFunction(fn)](#joshprovider-somebyfunction-fn-promise-less-than-boolean-greater-than) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.everyByPath(path, value)](#joshprovider-everybypath-path-value-promise-less-than-boolean-greater-than) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.everyByFunction(fn)](#joshprovider-everybyfunction-fn-promise-less-than-boolean-greater-than) ⇒ <code>Promise.&lt;boolean&gt;</code>
    * [.close()](#joshprovider-close)
    * [.destroy()](#joshprovider-destroy)
    * [.autoId()](#joshprovider-autoid-promise-less-than-string-greater-than) ⇒ <code>Promise.&lt;string&gt;</code>
    * [.parseData(data)](#joshprovider-parsedata-data) ⇒ <code>\*</code>

<a name="new_JoshProvider_new"></a>

### new JoshProvider([options])

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>Object</code> | An object containing all the options required for your provider, as well as the ones provided by default with every provider. |
| [options.name] | <code>string</code> | Required. The name of the table in which to save the data. |

<a name="JoshProvider+init"></a>

### joshProvider.init(Josh) ⇒ <code>Promise</code>
Internal method called on persistent Josh to load data from the underlying database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise</code> - Returns the defer promise to await the ready state.  

| Param | Type | Description |
| --- | --- | --- |
| Josh | <code>Map</code> | In order to set data to the Josh, one must be provided. |

<a name="JoshProvider+get"></a>

### joshProvider.get(key, path) ⇒ <code>Promise.&lt;\*&gt;</code>
Retrieves a single value from the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;\*&gt;</code> - The data stored for the key, or at the path.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The database key where the value is stored |
| path | <code>string</code> | Optional. Null if not provided by the user. The path within the key where the object is located. The path must support the same syntax as lodash does, for example: 'a[0].b.c' |

<a name="JoshProvider+getAll"></a>

### joshProvider.getAll() ⇒ <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code>
* Retrieves all values from the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code> - An object consisting of every key and value in the database.At the top level, the key is what the user providers when using set(key, value) and the value in the object is whatever's in the database.Every value should be parsed using `this.parseData()`  
<a name="JoshProvider+getMany"></a>

### joshProvider.getMany(keys) ⇒ <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code>
Retrieves one or many values from the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code> - An object consisting every key requested by the user, and its value in the datbase.At the top level, the key is what the user providers when using set(key, value) and the value in the object is whatever's in the database.Every value should be parsed using `this.parseData()`  

| Param | Type | Description |
| --- | --- | --- |
| keys | <code>Array.&lt;string&gt;</code> | A list of keys to retrieve from the database. |

<a name="JoshProvider+random"></a>

### joshProvider.random(count) ⇒ <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code>
Retrieves one or more random values from the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Object.&lt;\*&gt;&gt;</code> - An object representing one or more random keys taken from the database, with their values.At the top level, the key is what the user providers when using set(key, value) and the value in the object is whatever's in the database.Every value should be parsed using `this.parseData()`  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| count | <code>Number</code> | <code>1</code> | An integer representing the number of random values to obtain from the database. |

<a name="JoshProvider+randomKey"></a>

### joshProvider.randomKey(count) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Retrieves a random key from all the database keys for this Josh.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - An array of random keys taken from the database, or a single key if count is 1.  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| count | <code>Number</code> | <code>1</code> | An integer representing the number of random keys to obtain from the database. |

<a name="JoshProvider+has"></a>

### joshProvider.has(key, path) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies whether a key, or value at path, exists in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Whether the key (or value at path) exists.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key of which the existence should be checked. |
| path | <code>string</code> | Optional. Null if not provided by the user. If provided, should return whether a value exists at that path, assuming the key exists. |

<a name="JoshProvider+keys"></a>

### joshProvider.keys() ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Retrieves all the indexes (keys) in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - Array of all indexes (keys) in the database.  
<a name="JoshProvider+values"></a>

### joshProvider.values() ⇒ <code>Promise.&lt;array.&lt;\*&gt;&gt;</code>
Retrieves all of the values in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
<a name="JoshProvider+count"></a>

### joshProvider.count() ⇒ <code>Promise.&lt;integer&gt;</code>
Retrieves the number of rows in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;integer&gt;</code> - The number of rows in the database.  
<a name="JoshProvider+set"></a>

### joshProvider.set(key, path, val) ⇒ <code>Promise.&lt;Provider&gt;</code>
Saves a key in the database, along with its value.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The name of the key. If the key already exists, the value should be overriden. |
| path | <code>string</code> | Optional. Null if not provided by the user. Defines where, in an object or array value, to place the provided data. |
| val | <code>\*</code> | The data to write in the database for the key, or at the path for this key. This value MUST be written using serialize-javascript |

<a name="JoshProvider+setMany"></a>

### joshProvider.setMany(data, overwrite) ⇒ <code>Promise.&lt;Provider&gt;</code>
Writes many different keys and their values to the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>Object</code> | The data to write to the database. Should be an object where each property is a key and its value is the value to write. Does not support writing with paths. Format is: ```json {   key1: 'value1',   key2: 'value2', } ``` |
| overwrite | <code>boolean</code> | Whether to overwrite existing keys provided in the incoming data. |

<a name="JoshProvider+delete"></a>

### joshProvider.delete(key, path) ⇒ <code>Promise.&lt;Provider&gt;</code>
Deletes a key and its value, or the part of an object or array value, from the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The name of the key to remove, or *from* which value to remove data at the path. |
| path | <code>string</code> | Optional. Null if not provided by the user. The path that should be deleted, if one is provided. Ideally, this could use `unset()` from lodash. |

<a name="JoshProvider+clear"></a>

### joshProvider.clear() ⇒ <code>Promise.&lt;Provider&gt;</code>
Deletes every single entry in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  
<a name="JoshProvider+push"></a>

### joshProvider.push(key, path, value, allowDupes) ⇒ <code>Promise.&lt;Provider&gt;</code>
Pushes a new value into an array stored in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key where to push a new value. The key's value must be an array (unless a path is used, then it should be an object). |
| path | <code>string</code> | Optional. Null if not provided by the user. If provided, the value at that path should be an array. |
| value | <code>\*</code> | The value to push into the array. |
| allowDupes | <code>boolean</code> | Whether to allow duplicates to be pushed into the array. If true, should not ... well... allow duplicates. |

<a name="JoshProvider+remove"></a>

### joshProvider.remove(key, path, val) ⇒ <code>Promise.&lt;Provider&gt;</code>
Removes a value from an array stored in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key where to remove a value from. The key's value must be an array (unless a path is used). |
| path | <code>string</code> | Optional. Null if not provided by the user. If provider, the value at that path should be an array. |
| val | <code>\*</code> \| <code>function</code> | The value to remove from the array, or a function provided by the user to remove from the array (using findIndex). |

<a name="JoshProvider+inc"></a>

### joshProvider.inc(key, path) ⇒ <code>Promise.&lt;Provider&gt;</code>
Increments a numerical value within the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key to increment. The value must be a Number. |
| path | <code>string</code> | Optional. Null if not provided by the user. If provided, the value at that path must be a Number value. |

<a name="JoshProvider+dec"></a>

### joshProvider.dec(key, path) ⇒ <code>Promise.&lt;Provider&gt;</code>
Decrements a numerical value within the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key to decrement. The value must be a Number. |
| path | <code>string</code> | Optional. Null if not provided by the user. If provided, the value at that path must be a Number value. |

<a name="JoshProvider+math"></a>

### joshProvider.math(key, path, operation, operand) ⇒ <code>Promise.&lt;Provider&gt;</code>
Executes a mathematical operation on a numerical value within the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Provider&gt;</code> - This provider.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key where the operation should be executed. The value must be a Number value. |
| path | <code>string</code> | Optional. Null if not provided by the user. If provided, the value at the path must be a Number value. |
| operation | <code>string</code> | One of the supported operations (listed in this function). |
| operand | <code>Number</code> | The secondary Number for the mathematical operation. |

<a name="JoshProvider+findByFunction"></a>

### joshProvider.findByFunction(fn, path) ⇒ <code>Promise.&lt;\*&gt;</code>
Finds and returns a value using a function.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;\*&gt;</code> - The first value found by the function, or `null` if no value found.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | A function to execute on every value in the database. This function should provide both the `value` and `key` as arguments and will return a boolean. findByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution) |
| path | <code>string</code> | Optional. If provided, the function should be provided the value at the path rather than at the root. |

<a name="JoshProvider+findByValue"></a>

### joshProvider.findByValue(path, value) ⇒ <code>Promise.&lt;\*&gt;</code>
Finds and returns an entire value, by checking whether a specific sub-value was found a the given path.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;\*&gt;</code> - The first value found, or `null` if no value found.  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | The path where to check if the value is present |
| value | <code>\*</code> | The value to check for equality. |

<a name="JoshProvider+filterByFunction"></a>

### joshProvider.filterByFunction(fn, path) ⇒ <code>Promise.&lt;Object&gt;</code>
Finds and returns one or more values using a function to check whether the value is desired.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - The values found by the function, or `{}` if no value found.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | A function to execute on every value in the database. This function should be provided both the `value` and `key` as arguments and will return a boolean. filterByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution) |
| path | <code>string</code> | The path where to check if the value is present |

<a name="JoshProvider+filterByValue"></a>

### joshProvider.filterByValue(path, value) ⇒ <code>Promise.&lt;Object&gt;</code>
Finds and returns one or move value, by checking whether a specific sub-value was found at the given path.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Object&gt;</code> - The values found by this function, or `{}` if no value found.  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | The path where to check if the value is present |
| value | <code>\*</code> | The value to check for equality. |

<a name="JoshProvider+mapByValue"></a>

### joshProvider.mapByValue(path) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Retrieves the value at the specified path for every stored object or array in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - An array of the values at that path  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | The path to get the data from. |

<a name="JoshProvider+mapByFunction"></a>

### joshProvider.mapByFunction(fn) ⇒ <code>Promise.&lt;Array.&lt;\*&gt;&gt;</code>
Runs a function for every value in the database and returns an array with the return of that function for each value.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;Array.&lt;\*&gt;&gt;</code> - An array of the values returned by the function for each value.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | The function should be provided the `key` and `value` as arguments (in that order) and will return a value. mapByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution) |

<a name="JoshProvider+includes"></a>

### joshProvider.includes(key, path, val) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies if a value is part of an array at the key (or the path within that key).

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Whether the value is in the array.  

| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The key in which to verify the existence of the value. Should be an array, unless a path is used. |
| path | <code>string</code> | Optional. Null if not provided by the user. Value at this path is expected to be an array. |
| val | <code>\*</code> | The value to check in the array. |

<a name="JoshProvider+someByPath"></a>

### joshProvider.someByPath(path, value) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies if the provided value is located in *any* of the values stored in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Should return true as soon as the value is found, or false if it hasn't been.  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | Optional. Null if not provided by the user. If provided, the value would need to be equal to the data stored at that path. |
| value | <code>\*</code> | The value to check for at that path. |

<a name="JoshProvider+someByFunction"></a>

### joshProvider.someByFunction(fn) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies if something is true in any of the values stored in the database, through a function.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Whether the `fn` has returned true for any value.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | The function should be provided both the `value` and `key` for each entry in the database, and will return a boolean. someByFunction is expected to return `true` immediately on the first occurence of the `fn` returning true. someByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution) |

<a name="JoshProvider+everyByPath"></a>

### joshProvider.everyByPath(path, value) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies if a value at a path is identical to the one provided, for every single value stored in the database.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Whether the value was equal to the one at the path for every single value in the database.  

| Param | Type | Description |
| --- | --- | --- |
| path | <code>string</code> | The path where the value should be checked. |
| value | <code>\*</code> | The value that should be checked for equality at that path. |

<a name="JoshProvider+everyByFunction"></a>

### joshProvider.everyByFunction(fn) ⇒ <code>Promise.&lt;boolean&gt;</code>
Verifies if a condition is true on every single value stored in the database, using a function.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - Whether the `fn` has returned true for every value.  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>function</code> | The function should be provided botht he `value` and `key` for each entry in the database, and will return a boolean. everyByFunction should support asynchronous functions (the `fn` return could be a promise that requires resolution) |

<a name="JoshProvider+close"></a>

### joshProvider.close()
Closes the database. This function should be used to shut down any connection or file access to the database this provider refers to.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
<a name="JoshProvider+destroy"></a>

### joshProvider.destroy()
Deletes the database. This function should delete everything in the specific table used by this database (for the josh's **name** specifically)It should also remove any temporary table, as well as the "autoid" saved for it.After this method is run, no trace of the specific josh should exist.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
<a name="JoshProvider+autoId"></a>

### joshProvider.autoId() ⇒ <code>Promise.&lt;string&gt;</code>
Returns the "next" automatic ID for this josh. AutoId should be a string, and can technically be anything you want - either a numerically incremented value or justan automatic row ID or DB ID (autonum, mongo's _id , etc). No 2 Ids should ever be identical.

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>Promise.&lt;string&gt;</code> - An automatic ID.  
<a name="JoshProvider+parseData"></a>

### joshProvider.parseData(data) ⇒ <code>\*</code>
Internal method to read data from the database.This is essentially the contrary of `serialize-javascript`'s "serialize()" method.Note: EVAL IS NORMAL. As long as 100% of the data you read from this has been written by serialize(), this is SAFE. If you have any doubts as to what data has been written,or if you have to deal with mixed or unsafe data, then you should take further action to ensure you are not subject to security breaches!

**Kind**: instance method of [<code>JoshProvider</code>](#joshprovider)  
**Returns**: <code>\*</code> - A value parsed through eval, which will be valid javascript.  

| Param | Type | Description |
| --- | --- | --- |
| data | <code>string</code> | A string ("JSON") generated by `serialize-javascript`. |

