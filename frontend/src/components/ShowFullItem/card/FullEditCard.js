import {useState,useEffect,useContext,useRef} from 'react';
import { AppContext } from '../../../context';
import { capitalizeFirstLetter, validateProductText } from './productFormUtils';


export default function FullEditCard({item}) {
      const [previewUrl, setPreviewUrl] = useState("");
      const [isSubmitting, setIsSubmitting] = useState(false);
      const {user: {role}, getCsrfToken} = useContext(AppContext)
  const [selectedFile, setSelectedFile] = useState(null);


  const [formData, setFormData]= useState({
    title:item.title || '',
    desc:item.desc|| '',
    price:item.price|| '',
    quantity:item.quantity || '',
    img:item.img||''
  })
  const savedFromDataRef = useRef({
    title:item.title || '',
    desc:item.desc|| '',
    price:item.price|| '',
    quantity:item.quantity || '',
    img:item.img||''
  })
  
  const fileInputRef = useRef(null);
  const submissionInProgressRef = useRef(false);

  async function handleSubmit(event){
    if (submissionInProgressRef.current) return;
    event.preventDefault();
    const form = event.currentTarget;
    const handleFormData = new FormData(form);
    const title = capitalizeFirstLetter(String(handleFormData.get('title') || ''));
    const description = capitalizeFirstLetter(String(handleFormData.get('desc') || ''));
    const textError = validateProductText(title, description);
    if (textError) {
      alert(textError);
      const invalidField = textError.startsWith('Название') || !title.trim() ? 'title' : 'desc';
      form.elements.namedItem(invalidField).focus();
      return;
    }
    handleFormData.set('title', title);
    handleFormData.set('desc', description);

    const saved = savedFromDataRef.current;
    
    const fields = role ==="admin"
    ? ['title','desc','price','quantity']
    : ['title','desc','price'];

    const normalize =(field, value)=>['price','quantity'].includes(field)
        ? value===''?'': Number(value)
        :String( value??'')

    const hasFieldChanges=fields.some((field)=>
    normalize(field,formData[field])!==
  normalize(field,saved[field])
);
const hasChanges = hasFieldChanges|| Boolean(selectedFile);
if(!hasChanges) return;
    submissionInProgressRef.current = true;
    setIsSubmitting(true);
    try{
      const response = await fetch (`http://localhost:3000/products/${item.id}`,{
        method:'PATCH',
        headers:{
          "X-CSRF-Token":  await getCsrfToken(),
        },
        credentials:'include',
        body:handleFormData
      })
      const data = await response.json();
      if(!response.ok){
        throw new Error (data.message||'Проблема при изменении данних товара')
      }

      const savedFormData ={
        title:data.title || '',
    desc:data.desc|| '',
    price:data.price|| '',
    quantity:data.quantity || '',
    img:data.img||''
      }
      item.img=data.img;
      savedFromDataRef.current = savedFormData;
      setFormData(savedFormData);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      console.log("Данные успешно изменены");
    }
    catch(error){
      alert (error.message ||'Ошибка при изменении данных')
    } finally {
      submissionInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }
  function handleChange(event){
    const {name,value} = event.target;
    const updatedValue = ['title', 'desc'].includes(name)
      ? capitalizeFirstLetter(value)
      : value;

    setFormData((current)=>({
      ...current, 
      [name]:updatedValue,
    }))
  }

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  return (
       <div className="card-edit-product">
            <div className="preview-block__image">
              <img src={previewUrl || formData.img} alt={formData.title || "preview-image"} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <input
                  type="file"
                  name="photo"
                  className="action-button white-button"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(event) =>
                    setSelectedFile(event.target.files[0] || null)
                  }
                />
                <button
                  id={"cancel-file"}
                  type="button"
                  className="action-button white-button"
                  onClick={() => {
                    setSelectedFile(null);
                    fileInputRef.current.value = "";
                  }}
                >
                  Сбросить
                </button>
              </div>
              <div className="form-row">
                <label htmlFor="title">Название товара</label>
               <input type="text" name="title" value={formData.title}  onChange={handleChange} placeholder="Название товара" />
              </div>
              <div className="form-row">
              <label htmlFor="desc">Описание</label>
              <textarea name="desc" rows="5" cols="40" id={item.id} value={formData.desc}  onChange={handleChange} placeholder="Опишите товар...">
          
              </textarea>

              </div>
              <div className="form-row">

              <label htmlFor="price">Цена:</label>
              <input type="number" name="price"  onChange={handleChange} value={formData.price} />
              </div>
              <div className="form-row">
                <label htmlFor="quantity">Количество</label>
              
                <input type="number" name="quantity" value={formData.quantity}  onChange={(e)=>{if(role!=='admin'){return} handleChange(e)}} disabled={role!=="admin"}/>
              </div>
            <button type='submit' className="save-button action-button" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
            </form>
          </div>
  )
}
