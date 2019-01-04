let jsonBeautifully = Editor.require('packages://jsoneditor/node_modules/json-beautifully');
let fs = require('fs-extra');
let path = require('fire-path');
let nodeXlsx = Editor.require('packages://jsoneditor/node_modules/node-xlsx');
var chokidar = Editor.require('packages://jsoneditor/node_modules/chokidar');
Editor.Panel.extend({
  style: fs.readFileSync(Editor.url('packages://jsoneditor/panel/index.css', 'utf8')) + "",
  template: fs.readFileSync(Editor.url('packages://jsoneditor/panel/index.html', 'utf8')) + "",

  $: {
    lis: "#lis",
    li: "#li",
    a: "#a",
    selectDir: "#selectFileDir",
    selectExcel: "#selectExcel",
    text: "#text",
    file: "#file",
    save: "#save",
    error: "#error",
    clear: "#clear",
    search: "#search",
    rows: "#rows",
    row: "#row",
  },

  ready() {
    let lis = this.$lis;
    let li = this.$li;
    let text = this.$text;
    let filename = this.$file;
    let errlog = this.$error;
    let search = this.$search;
    let rows = this.$rows;
    let row = this.$row;
    var allFileArr = [];
    let jsonRootPath = [];
    this.excelPath = [];
    var excelTrans = [];
    init();
    function init() {
      li.setAttribute("style", "display:block");

    }

    //监控文件变化
    function _watchDir(event, filePath) {
      selectJsonFile(jsonRootPath);
    }

    //日志打印
    function _addlog(result) {
      var log = errlog.value;
      if (log == "") {
        errlog.value = result;
      } else {
        errlog.value = log + "\n" + result;
      }
    }

    this.$text.onkeydown = (event) => {
      var data = text.value;
      Editor.log("data" + data);
    }

    this.$text.onkeyup = (event) => {
      if (event.keyCode == 13 || event.keyCode == 8) { //如果按的是enter键 13是enter 
        initRow(text.value);
      }
    }

    this.$text.onscroll = () => {
      rows.scrollTop = text.scrollTop;
    }

    //选择目录
    this.$selectDir.onclick = () => {
      let res = Editor.Dialog.openFile({
        title: "选择Json的根目录",
        defaultPath: Editor.projectInfo.path,
        properties: ['openDirectory'],
      });
      if (res !== -1) {
        let dir = res[0];

        if (dir !== jsonRootPath) {
          jsonRootPath = dir;
          chokidar.watch(jsonRootPath).on('all', _watchDir.bind(this));
          selectJsonFile(dir);
        }
      }
    }

    this.$selectExcel.onclick = () => {
      let res = Editor.Dialog.openFile({
        title: "选择Excel的文件",
        defaultPath: Editor.projectInfo.path,
        properties: ['openFile'],
        filters: [
          { name: 'Files', extensions: ['xls', 'xlsx'] },
        ]
      });
      if (res !== -1) {
        let dir = res[0];
        if (jsonRootPath == "") {
          _addlog('尚未选择Json文件存放目录');
        } else {
          //解析excel文件
          this.excelPath = dir;
          readExcelSync(dir, jsonRootPath);
        }
      }
    }

    this.$search.onblur = () => {
      if (text.value !== "" && search.value !== "") {
        var arr = text.value.split(search.value);
        var index = 0;
        for (var i = 0; i < arr.length - 1; i++) {
          var row = arr[i].split('\n').length - 1;
          if (index > 0) {
            index = index + row;
          } else {
            index = row + 1;
          }
          _addlog("匹配到[" + search.value + "]的结果在第" + index + "行");
        }
        var v = search.value;
        var l = search.value.length;
        //创建选择区域	

        text.setSelectionRange(l - v.length, l);
        text.focus();
      }
    }

    this.$save.onclick = () => {
      var res = filename.value;
      var value = text.value;
      if (res != "") {
        try {
          var e = JSON.parse(value);
          var result = jsonBeautifully(value);
          try {
            fs.outputFile(res, result, err => {
              alert('保存成功')
            });
          } catch (err) {
            _addlog("JSON数据格式有误" + err);
          }

        } catch (error) {
          _addlog("JSON数据格式有误" + error);
        }
      } else {
        if(jsonRootPath == ""){
          alert("请选择JSON目录");
        }else{
          try {
            let res = Editor.Dialog.saveFile({
              title: "选择保存Json文件的路径",
              defaultPath: jsonRootPath+"\\json",
              filters: [
                { name: 'Files', extensions: ['json'] },
              ]
            });
            
            if (res != "") {
              fs.outputFile(res, result, err => {
                alert("保存成功")
              });
            }
          } catch (error) {
            
          }
        }
      }

    }

    this.$clear.onclick = () => {
      errlog.value = "";
    }

    // 查找出目录下的所有文件
    function selectJsonFile(dir) {
      if (dir) {
        // 获取目录下所有的文件
        readDirSync(dir);
        initDirSync(lis, allFileArr);
      }
    }

    //读取所有文件
    function readDirSync(dirPath) {
      let node = [];
      let id = 0;
      let dirInfo = fs.readdirSync(dirPath, "utf8");

      for (let i = 0; i < dirInfo.length; i++) {
        let items = {};
        let item = dirInfo[i];
        let itemFullPath = path.join(dirPath, item);
        let info = fs.statSync(itemFullPath);
        id++;
        if (info.isDirectory()) {
          items.id = id;
          items.name = item;
          items.dir = itemFullPath;
          items.children = readDirSync(itemFullPath);
          node.push(items)
        } else if (info.isFile()) {

          //去除除json文件外的所有文件
          let extName = path.extname(itemFullPath);
          if (extName === ".json" || extName === ".json") {
            items.id = id;
            items.name = item;
            items.dir = itemFullPath;
            node.push(items)
          } else {
            id--;
            continue;
          }
        }
      }
      allFileArr = node;
      return node;
    }

    //数据组装并生成元素显示
    function initDirSync(parentNode, data) {
      //清空目录
      for (var i = parentNode.children.length - 1; i >= 0; i--) {
        parentNode.removeChild(parentNode.children[i]);
      }
      let file = "";
      let info = {};
      var dir = [];
      //生成目录树
      for (var i = 0; i < data.length; i++) {
        file = data[i].dir;
        info = fs.statSync(file);

        if (info.isFile()) {
          let newli = li.cloneNode(true);
          newli.querySelector('span').innerHTML = `<img src="packages://jsoneditor/img/text.png"/>` + data[i].name;
          dir.push(data[i].dir);
          newli.querySelector('a').onclick = () => {
            initJson(dir, newli.querySelector('span').innerHTML.split('>')[1]);
          }
          newli.setAttribute("style", "padding-left:40px");
          parentNode.appendChild(newli);
        } else if (info.isDirectory()) {
          let newli = li.cloneNode(true);
          let name = data[i].name;
          newli.querySelector('span').innerHTML = `<i class="icon-down-dir"></i><img src="packages://jsoneditor/img/folder.png"/>` + data[i].name;
          let newlis = lis.cloneNode();
          newli.appendChild(newlis);
          let newdata = data[i].children;
          newli.querySelector('a').onclick = function () {
            if (newli.querySelector('ul').style.display == "none") {
              newli.querySelector('span').innerHTML = `<i class="icon-down-dir"></i><img src="packages://jsoneditor/img/folder.png"/>` + name;
              newli.querySelector('ul').setAttribute("style", "display:block");
            } else {
              newli.querySelector('span').innerHTML = `<i class="icon-right-dir"></i><img src="packages://jsoneditor/img/folder.png"/>` + name;
              newli.querySelector('ul').setAttribute("style", "display:none");
            }
          }
          parentNode.appendChild(newli);
          parentNode.insertBefore(parentNode.children[parentNode.children.length-1],parentNode.children[0]);
          if (newdata == "") {
            continue;
          } else {
            initDirSync(newlis, newdata);
          }
        }
      }
    }

    //解析Excel文件
    function readExcelSync(filePath, dirPath) {
      let excelSheetArray = [];
      let excelData = nodeXlsx.parse(filePath);
      let itemFullPath = "";

      for (let k in excelData) {
        let exceldata = {
          sheetName: excelData[k].name,
          data: excelData[k].data,
          unique: 0,
          ignore: null,
        }
        let result = [];
        if (exceldata.data == "") {
          _addlog(exceldata.sheetName + "表：表数据为空");
          continue;
        } else if (exceldata.sheetName.split("|").length == 1 || exceldata.sheetName.split("|")[0] == "") {
          _addlog(exceldata.sheetName + "表：命名格式错误");
        } else if (exceldata.sheetName.split("|")[0] !== "") {
          let name = exceldata.sheetName.split("|")[0];
          //处理sheet表重名问题
          for (var x in excelSheetArray) {
            if (name == excelSheetArray[x]) {
              _addlog("sheet表重名");
              return;
            }
          }
          excelSheetArray.push(name);

          //存储json文件保存路径
          let jsonpath = "json/" + name + ".json";
          itemFullPath = path.join(dirPath, jsonpath);
          excelTrans.push(itemFullPath);
          result = dataPack(exceldata, name);//组装数据
          try {
            if (result.length !== 0) {
              transExcel(result, itemFullPath, name);
            }
          } catch (error) {

          }

        }
      }
    }

    //组装数据
    function dataPack(exceldata, sheetName) {
      let prop = [];
      let oneDataArr = [];
      let data = []
      let unique = [];
      let ignore = [];

      for (var j in exceldata.data) {
        let text = {};

        //处理ignore忽略值
        if (ignore != "") {
          for (var k in ignore) {
            exceldata.data[j][ignore[k]] = "";
          }
        };
        //处理@unique唯一值
        if (unique != "") {
          for (var k in unique) {
            let oneData = exceldata.data[j][unique[k]];
            oneDataArr.push(oneData);
            //递归判断Excel文件中设置唯一值的属性是否有相同的数组
            for (var i = 2; i < oneDataArr.length; i++) {
              let twoData = oneDataArr;
              for (var h = 2; h < twoData.length; h++) {
                if (i !== h) {
                  if (oneDataArr[i] == twoData[h]) {
                    _addlog(sheetName + "表：定义了唯一值，但第" + (i + 2) + "行与第" + (h + 2) + "行的值不唯一");
                    return;
                  }
                }
              }
            }
          }
        }

        if (j == 0) {
          for (var l in exceldata.data[j]) {
            if (exceldata.data[j][l] == "@unique") {
              unique.push(l);
            } else if (exceldata.data[j][l] == "ignore") {
              ignore.push(l);
            } else if (exceldata.data[j][l] == "") {
              continue;
            } else {
              _addlog(sheetName + "表：数据有误");
              return;
            }
          }
        } else if (j == 1) {
          continue;
        } else if (j == 2) {
          for (var l in exceldata.data[j]) {
            let p = exceldata.data[j][l];
            prop.push(p);
          }
        } else {
          for (var l in exceldata.data[j]) {

            if (prop[l] != "") {

              let r = exceldata.data[j][l];
              text[prop[l]] = r;

            }
          }
          var d = JSON.stringify(text);
          if (d !== "{}") { //过滤空行
            data.push(text);
          }


        }

      }
      return data;
    }

    //文件内容显示
    function initJson(data, name) {
      let nameArr = [];
      for (var k in data) {
        let arr = data[k].split('\\');
        nameArr.push(arr[arr.length - 1]);
        if (nameArr[k] == name) {
          text.value = "";
          filename.value = data[k];
          try {
            fs.readFile(data[k], 'utf8', (err, data) => {
              if (err) return Editor.log(err)

              var result = jsonBeautifully(data);//格式化代码
              Editor.log(data)
              if (result !== "undefined") {
                text.value = result;
                initRow(text.value);
              } else {
                text.value = data;
                initRow(text.value);
              }
            })
          } catch (err) {
            _addlog("Json文件字符串有误");
            text.value = err;
          }
        }
      }
    }

    //内容行数显示
    function initRow(data) {
      var indexs = data.split("\n").length;
      //清空目录
      for (var i = rows.children.length - 1; i >= 0; i--) {
        rows.removeChild(rows.children[i]);
      }
      for (var j = 1; j <= indexs; j++) {

        var r = row.cloneNode(true);
        r.innerHTML = j;
        rows.appendChild(r);
      }
    }

    //转换成JSON文件
    function transExcel(data, res, name) {
      text.value = "";
      var info = JSON.stringify(data);
      var result = jsonBeautifully(info);//格式化代码
      try {
        fs.outputFile(res, result, err => {
          filename.value = "";
          text.value = "Excel表转换完成";
          initRow(text.value);
        });
      } catch (err) {
        _addlog(name + "表转换有误:" + err);
      }
    }
  }
});